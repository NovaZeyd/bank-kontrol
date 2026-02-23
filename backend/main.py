"""
Bank Kontrol Sistemi - FastAPI Backend
Ana uygulama dosyası
"""

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import List, Optional
from decimal import Decimal
import os

from models import (
    BankaHesap, BankaHareketi, Rapor, Rehber, Kullanici,
    IslemTuru, create_engine_from_url, get_session_maker, create_tables, Base
)
from pdf_parser import PDFBankaParser, ExcelExporter
from pydantic import BaseModel, Field
from jose import JWTError, jwt
from passlib.context import CryptContext

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/bank_kontrol")
engine = create_engine_from_url(DATABASE_URL)
SessionLocal = get_session_maker(engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI(
    title="Bank Kontrol Sistemi",
    description="Banka əməliyyatlarını izləmə və idarəetmə sistemi",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ SCHEMALAR ============

class Token(BaseModel):
    access_token: str
    token_type: str

class BankaHesapCreate(BaseModel):
    sirket_adi: str
    banka_adi: str
    iban: str
    valyuta: str = "AZN"
    voen: Optional[str] = None

class BankaHesapResponse(BaseModel):
    id: int
    sirket_adi: str
    banka_adi: str
    iban: str
    valyuta: str
    voen: Optional[str]
    acilis_bakiye: Optional[float]
    kapanis_bakiye: Optional[float]
    
    class Config:
        from_attributes = True

class HareketCreate(BaseModel):
    tarixi: datetime
    islem_turu: IslemTuru
    mebleg: float
    valyuta: str = "AZN"
    teyinat: Optional[str] = None
    acs_hesap: Optional[str] = None
    sened_no: Optional[str] = None

class HareketResponse(BaseModel):
    id: int
    tarixi: datetime
    islem_turu: str
    mebleg: float
    valyuta: str
    bakiye: Optional[float]
    teyinat: Optional[str]
    acs_hesap: Optional[str]
    
    class Config:
        from_attributes = True

class OzetResponse(BaseModel):
    toplam_medaxil: float
    toplam_mexaric: float
    cari_qaliq: float
    gunluk_hareketler: List[HareketResponse]

class RehberCreate(BaseModel):
    ad_soyad: str
    email: Optional[str] = None
    telefon: Optional[str] = None
    varsayilan: bool = False

class RaporTalep(BaseModel):
    hesap_id: int
    rapor_turu: str  # gunluk, aylik, illik
    baslangic: Optional[datetime] = None
    bitis: Optional[datetime] = None

# ============ AUTH ============

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@app.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(Kullanici).filter(Kullanici.kullanici_adi == form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.sifre_hash):
        raise HTTPException(status_code=400, detail="Yanlış istifadəçi adı və ya şifrə")
    
    access_token = create_access_token(data={"sub": user.kullanici_adi})
    return {"access_token": access_token, "token_type": "bearer"}

# ============ HESAPLAR ============

@app.get("/hesaplar", response_model=List[BankaHesapResponse])
def hesaplari_getir(db: Session = Depends(get_db)):
    """Bütün banka hesablarını gətir"""
    return db.query(BankaHesap).filter(BankaHesap.aktif == True).all()

@app.post("/hesaplar", response_model=BankaHesapResponse, status_code=status.HTTP_201_CREATED)
def hesap_olustur(hesap: BankaHesapCreate, db: Session = Depends(get_db)):
    """Yeni banka hesabı yarat"""
    db_hesap = BankaHesap(**hesap.dict())
    db.add(db_hesap)
    db.commit()
    db.refresh(db_hesap)
    return db_hesap

@app.get("/hesaplar/{hesap_id}", response_model=BankaHesapResponse)
def hesap_detay(hesap_id: int, db: Session = Depends(get_db)):
    """Hesab detallarını gətir"""
    hesap = db.query(BankaHesap).filter(BankaHesap.id == hesap_id).first()
    if not hesap:
        raise HTTPException(status_code=404, detail="Hesab tapılmadı")
    return hesap

@app.delete("/hesaplar/{hesap_id}")
def hesap_sil(hesap_id: int, db: Session = Depends(get_db)):
    """Hesabı deaktiv et (sil)"""
    hesap = db.query(BankaHesap).filter(BankaHesap.id == hesap_id).first()
    if not hesap:
        raise HTTPException(status_code=404, detail="Hesab tapılmadı")
    hesap.aktif = False
    db.commit()
    return {"message": "Hesab deaktiv edildi"}

# ============ ÖZET (ANASAYFA) ============

@app.get("/ozet", response_model=OzetResponse)
def ozet_getir(db: Session = Depends(get_db)):
    """Ana səhifə üçün ümumi məlumatlar"""
    
    # Bu günün tarixi
    bugun = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Bütün hərəkətləri al
    hareketler = db.query(BankaHareketi).filter(
        BankaHareketi.tarixi >= bugun
    ).order_by(BankaHareketi.tarixi.desc()).all()
    
    # Toplam mədaxil və məxaric
    medaxil = db.query(func.sum(BankaHareketi.mebleg)).filter(
        BankaHareketi.mebleg > 0
    ).scalar() or 0
    
    mexaric = db.query(func.sum(BankaHareketi.mebleg)).filter(
        BankaHareketi.mebleg < 0
    ).scalar() or 0
    
    # Son qalıq
    son_hareket = db.query(BankaHareketi).order_by(
        BankaHareketi.tarixi.desc()
    ).first()
    cari_qaliq = son_hareket.bakiye if son_hareket and son_hareket.bakiye else 0
    
    return OzetResponse(
        toplam_medaxil=float(medaxil),
        toplam_mexaric=abs(float(mexaric)),
        cari_qaliq=float(cari_qaliq),
        gunluk_hareketler=hareketler
    )

# ============ HAREKETLER ============

@app.get("/hesaplar/{hesap_id}/hareketler", response_model=List[HareketResponse])
def hareketler_getir(
    hesap_id: int, 
    baslangic: Optional[datetime] = None,
    bitis: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """Hesabın hərəkətlərini gətir"""
    query = db.query(BankaHareketi).filter(BankaHareketi.hesap_id == hesap_id)
    
    if baslangic:
        query = query.filter(BankaHareketi.tarixi >= baslangic)
    if bitis:
        query = query.filter(BankaHareketi.tarixi <= bitis)
    
    return query.order_by(BankaHareketi.tarixi.desc()).all()

@app.post("/hesaplar/{hesap_id}/hareketler", response_model=HareketResponse, status_code=201)
def hareket_ekle(hesap_id: int, hareket: HareketCreate, db: Session = Depends(get_db)):
    """Əl ilə yeni hərəkət əlavə et"""
    # Əvvəlki qalığı tap
    son_hareket = db.query(BankaHareketi).filter(
        BankaHareketi.hesap_id == hesap_id
    ).order_by(BankaHareketi.tarixi.desc()).first()
    
    onceki_bakiye = son_hareket.bakiye if son_hareket else Decimal('0')
    yeni_bakiye = onceki_bakiye + Decimal(str(hareket.mebleg))
    
    db_hareket = BankaHareketi(
        hesap_id=hesap_id,
        tarixi=hareket.tarixi,
        islem_turu=hareket.islem_turu,
        mebleg=Decimal(str(hareket.mebleg)),
        valyuta=hareket.valyuta,
        teyinat=hareket.teyinat,
        acs_hesap=hareket.acs_hesap,
        sened_no=hareket.sened_no,
        bakiye=yeni_bakiye
    )
    
    db.add(db_hareket)
    db.commit()
    db.refresh(db_hareket)
    return db_hareket

@app.delete("/hareketler/{hareket_id}")
def hareket_sil(hareket_id: int, db: Session = Depends(get_db)):
    """Hərəkəti sil"""
    hareket = db.query(BankaHareketi).filter(BankaHareketi.id == hareket_id).first()
    if not hareket:
        raise HTTPException(status_code=404, detail="Hərəkət tapılmadı")
    
    db.delete(hareket)
    db.commit()
    return {"message": "Hərəkət silindi"}

# ============ PDF YUKLEME ============

@app.post("/pdf-yukle")
def pdf_yukle(
    hesap_id: int,
    dosya: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """PDF ekstre yüklə və emal et"""
    if not dosya.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Yalnız PDF faylları dəstəklənir")
    
    # PDF-i oxu
    icerik = dosya.file.read()
    parser = PDFBankaParser()
    sonuc = parser.full_parse(icerik)
    
    if sonuc["bank_type"] == "unknown":
        raise HTTPException(status_code=400, detail="Banka formatı tanınmadı")
    
    # Hesabı tap və ya yarat
    hesap = db.query(BankaHesap).filter(BankaHesap.id == hesap_id).first()
    if not hesap:
        raise HTTPException(status_code=404, detail="Hesab tapılmadı")
    
    # Hərəkətləri bazaya yaz
    eklenen = 0
    for h in sonuc["hareketler"]:
        db_hareket = BankaHareketi(
            hesap_id=hesap_id,
            tarixi=datetime.strptime(h["tarixi"], "%d/%m/%Y" if "/" in h["tarixi"] else "%Y-%m-%d"),
            islem_turu=h["islem_turu"],
            mebleg=h["mebleg"],
            valyuta=h["valyuta"],
            bakiye=h.get("bakiye"),
            teyinat=h.get("teyinat"),
            acs_hesap=h.get("acs_hesap"),
            sened_no=h.get("sened_no"),
            kaynak_dosya=dosya.filename
        )
        db.add(db_hareket)
        eklenen += 1
    
    db.commit()
    
    return {
        "message": f"{eklenen} hərəkət əlavə edildi",
        "bank_type": sonuc["bank_type"],
        "toplam_medaxil": float(sonuc["toplam_medaxil"]),
        "toplam_mexaric": float(sonuc["toplam_mexaric"])
    }

# ============ RAPORLAR ============

@app.post("/raporlar/olustur")
def rapor_olustur(rapor: RaporTalep, db: Session = Depends(get_db)):
    """Aylıq/illik/günlük rapor yarat"""
    hesap = db.query(BankaHesap).filter(BankaHesap.id == rapor.hesap_id).first()
    if not hesap:
        raise HTTPException(status_code=404, detail="Hesab tapılmadı")
    
    # Tarix aralığı
    simdi = datetime.now()
    
    if rapor.rapor_turu == "gunluk":
        baslangic = simdi.replace(hour=0, minute=0, second=0)
        bitis = simdi
    elif rapor.rapor_turu == "aylik":
        baslangic = simdi.replace(day=1, hour=0, minute=0, second=0)
        bitis = simdi
    else:  # illik
        baslangic = simdi.replace(month=1, day=1, hour=0, minute=0, second=0)
        bitis = simdi
    
    # Hərəkətləri al
    hareketler = db.query(BankaHareketi).filter(
        BankaHareketi.hesap_id == rapor.hesap_id,
        BankaHareketi.tarixi >= baslangic,
        BankaHareketi.tarixi <= bitis
    ).all()
    
    # Excel yarat
    filename = ExcelExporter.export_to_excel(hareketler, rapor.rapor_turu)
    
    # Rapora yadda saxla
    medaxil = sum(float(h.mebleg) for h in hareketler if h.mebleg > 0)
    mexaric = sum(abs(float(h.mebleg)) for h in hareketler if h.mebleg < 0)
    
    yeni_rapor = Rapor(
        hesap_id=rapor.hesap_id,
        rapor_turu=rapor.rapor_turu,
        baslangic_tarihi=baslangic,
        bitis_tarihi=bitis,
        medaxil_toplam=medaxil,
        mexaric_toplam=mexaric,
        cari_qaliq=float(hareketler[-1].bakiye) if hareketler else 0,
        dosya_yolu=filename
    )
    
    db.add(yeni_rapor)
    db.commit()
    
    return {
        "rapor_id": yeni_rapor.id,
        "dosya": filename,
        "medaxil": medaxil,
        "mexaric": mexaric,
        "qaliq": yeni_rapor.cari_qaliq
    }

# ============ REHBER (MAIL/WHATSAPP) ============

@app.get("/rehber")
def rehber_getir(db: Session = Depends(get_db)):
    """Rehberdəki şəxsləri gətir"""
    return db.query(Rehber).filter(Rehber.aktif == True).all()

@app.post("/rehber", status_code=201)
def rehber_ekle(kisi: RehberCreate, db: Session = Depends(get_db)):
    """Rehberə şəxs əlavə et"""
    yeni = Rehber(**kisi.dict())
    db.add(yeni)
    db.commit()
    db.refresh(yeni)
    return yeni

@app.post("/raporlar/{rapor_id}/gonder")
def rapor_gonder(
    rapor_id: int,
    rehber_idler: List[int],
    kanal: str,  # email veya whatsapp
    db: Session = Depends(get_db)
):
    """Raporu mail/WhatsApp ilə göndər"""
    rapor = db.query(Rapor).filter(Rapor.id == rapor_id).first()
    if not rapor:
        raise HTTPException(status_code=404, detail="Rapor tapılmadı")
    
    rehber_kisiler = db.query(Rehber).filter(Rehber.id.in_(rehber_idler)).all()
    
    gonderilen = 0
    for kisi in rehber_kisiler:
        if kanal == "email" and kisi.email:
            # Email gönderim (implemente edilecek)
            gonderilen += 1
        elif kanal == "whatsapp" and kisi.telefon:
            # WhatsApp gönderim (implemente edilecek)
            gonderilen += 1
    
    return {"message": f"{gonderilen} şəxsə göndərildi", "kanal": kanal}

# ============ SAĞLIK KONTROLU ============

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "bank-kontrol-api", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
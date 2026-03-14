"""
Bank Kontrol Sistemi - FastAPI Backend
Ana uygulama dosyası
"""

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
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
import pandas as pd
import io

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

# ============ EXCEL YUKLEME ============

@app.post("/excel-yukle")
def excel_yukle(
    hesap_id: int,
    dosya: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Excel ekstre yüklə və emal et"""
    if not dosya.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Yalnız Excel faylları dəstəklənir (.xlsx, .xls)")

    hesap = db.query(BankaHesap).filter(BankaHesap.id == hesap_id).first()
    if not hesap:
        raise HTTPException(status_code=404, detail="Hesab tapılmadı")

    icerik = dosya.file.read()
    try:
        df = pd.read_excel(io.BytesIO(icerik))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Excel oxuma xətası: {str(e)}")

    # Sütun adlarını normallaşdır
    col_map = {}
    for col in df.columns:
        cl = str(col).lower().strip()
        if any(x in cl for x in ['tarix', 'date', 'tarixi']):
            col_map['tarixi'] = col
        elif any(x in cl for x in ['məbləğ', 'meblağ', 'mebleg', 'amount', 'sum']):
            col_map['mebleg'] = col
        elif any(x in cl for x in ['debet', 'debit', 'məxaric', 'mexaric', 'xərc']):
            col_map['debet'] = col
        elif any(x in cl for x in ['kredit', 'credit', 'mədaxil', 'medaxil', 'gəlir']):
            col_map['kredit'] = col
        elif any(x in cl for x in ['qalıq', 'qaliq', 'balance', 'bakiye']):
            col_map['bakiye'] = col
        elif any(x in cl for x in ['təyinat', 'teyinat', 'açıqlama', 'description', 'purpose']):
            col_map['teyinat'] = col
        elif any(x in cl for x in ['hesab', 'account', 'əks', 'acs']):
            col_map['acs_hesap'] = col
        elif any(x in cl for x in ['sənəd', 'sened', 'doc', 'nömrə']):
            col_map['sened_no'] = col
        elif any(x in cl for x in ['valyuta', 'currency']):
            col_map['valyuta'] = col

    eklenen = 0
    for _, row in df.iterrows():
        try:
            # Tarixi al
            if 'tarixi' in col_map:
                tarixi_val = row[col_map['tarixi']]
                if isinstance(tarixi_val, str):
                    for fmt in ['%d.%m.%Y', '%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y']:
                        try:
                            tarixi = datetime.strptime(tarixi_val.strip(), fmt)
                            break
                        except ValueError:
                            continue
                    else:
                        continue
                else:
                    tarixi = pd.Timestamp(tarixi_val).to_pydatetime()
            else:
                continue

            # Məbləği al
            if 'debet' in col_map and 'kredit' in col_map:
                debet = float(row[col_map['debet']] or 0) if pd.notna(row[col_map['debet']]) else 0
                kredit = float(row[col_map['kredit']] or 0) if pd.notna(row[col_map['kredit']]) else 0
                if kredit > 0:
                    mebleg = Decimal(str(kredit))
                    islem_turu = IslemTuru.MEDAXIL
                else:
                    mebleg = Decimal(str(debet))
                    islem_turu = IslemTuru.MEXARIC
            elif 'mebleg' in col_map:
                mebleg_val = float(row[col_map['mebleg']])
                mebleg = Decimal(str(abs(mebleg_val)))
                islem_turu = IslemTuru.MEDAXIL if mebleg_val > 0 else IslemTuru.MEXARIC
            else:
                continue

            bakiye = None
            if 'bakiye' in col_map and pd.notna(row[col_map['bakiye']]):
                bakiye = Decimal(str(float(row[col_map['bakiye']])))

            db_hareket = BankaHareketi(
                hesap_id=hesap_id,
                tarixi=tarixi,
                islem_turu=islem_turu,
                mebleg=mebleg,
                valyuta=row[col_map['valyuta']] if 'valyuta' in col_map and pd.notna(row[col_map['valyuta']]) else "AZN",
                bakiye=bakiye,
                teyinat=str(row[col_map['teyinat']]) if 'teyinat' in col_map and pd.notna(row[col_map['teyinat']]) else None,
                acs_hesap=str(row[col_map['acs_hesap']]) if 'acs_hesap' in col_map and pd.notna(row[col_map['acs_hesap']]) else None,
                sened_no=str(row[col_map['sened_no']]) if 'sened_no' in col_map and pd.notna(row[col_map['sened_no']]) else None,
                kaynak_dosya=dosya.filename
            )
            db.add(db_hareket)
            eklenen += 1

        except Exception:
            continue

    db.commit()

    return {
        "message": f"{eklenen} hərəkət əlavə edildi",
        "toplam_setir": len(df),
        "eklenen": eklenen,
        "fayl_adi": dosya.filename
    }

# ============ DETAYLI RAPORLAMA ============

@app.get("/raporlar/detayli")
def detayli_rapor(
    hesap_id: Optional[int] = None,
    rapor_turu: str = Query("aylik", regex="^(gunluk|aylik|illik)$"),
    baslangic: Optional[str] = None,
    bitis: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Detaylı rapor - günlük/aylıq/illik qruplaşdırma ilə"""
    query = db.query(BankaHareketi)

    if hesap_id:
        query = query.filter(BankaHareketi.hesap_id == hesap_id)

    if baslangic:
        query = query.filter(BankaHareketi.tarixi >= datetime.strptime(baslangic, "%Y-%m-%d"))
    if bitis:
        query = query.filter(BankaHareketi.tarixi <= datetime.strptime(bitis, "%Y-%m-%d"))

    hareketler = query.order_by(BankaHareketi.tarixi.desc()).all()

    # Qruplaşdırma
    gruplar = {}
    for h in hareketler:
        if rapor_turu == "gunluk":
            key = h.tarixi.strftime("%Y-%m-%d")
        elif rapor_turu == "aylik":
            key = h.tarixi.strftime("%Y-%m")
        else:
            key = h.tarixi.strftime("%Y")

        if key not in gruplar:
            gruplar[key] = {"donem": key, "medaxil": 0, "mexaric": 0, "sayi": 0, "hareketler": []}

        mebleg_val = float(h.mebleg)
        if h.islem_turu == IslemTuru.MEDAXIL or mebleg_val > 0:
            gruplar[key]["medaxil"] += abs(mebleg_val)
        else:
            gruplar[key]["mexaric"] += abs(mebleg_val)
        gruplar[key]["sayi"] += 1
        gruplar[key]["hareketler"].append({
            "id": h.id,
            "tarixi": h.tarixi.isoformat(),
            "islem_turu": h.islem_turu.value if isinstance(h.islem_turu, IslemTuru) else str(h.islem_turu),
            "mebleg": float(h.mebleg),
            "valyuta": h.valyuta,
            "bakiye": float(h.bakiye) if h.bakiye else None,
            "teyinat": h.teyinat,
            "acs_hesap": h.acs_hesap,
            "sened_no": h.sened_no,
            "kategori": h.kategori,
        })

    # Kateqoriya analizi
    kategoriler = {}
    for h in hareketler:
        kat = h.kategori or h.acs_hesap or "Digər"
        if kat not in kategoriler:
            kategoriler[kat] = {"ad": kat, "medaxil": 0, "mexaric": 0, "sayi": 0}
        mebleg_val = float(h.mebleg)
        if h.islem_turu == IslemTuru.MEDAXIL or mebleg_val > 0:
            kategoriler[kat]["medaxil"] += abs(mebleg_val)
        else:
            kategoriler[kat]["mexaric"] += abs(mebleg_val)
        kategoriler[kat]["sayi"] += 1

    toplam_medaxil = sum(g["medaxil"] for g in gruplar.values())
    toplam_mexaric = sum(g["mexaric"] for g in gruplar.values())

    return {
        "rapor_turu": rapor_turu,
        "toplam_medaxil": toplam_medaxil,
        "toplam_mexaric": toplam_mexaric,
        "fark": toplam_medaxil - toplam_mexaric,
        "toplam_emeliyyat": len(hareketler),
        "donemler": sorted(gruplar.values(), key=lambda x: x["donem"], reverse=True),
        "kategoriler": sorted(kategoriler.values(), key=lambda x: x["mexaric"], reverse=True),
    }

@app.get("/hesaplar/{hesap_id}/bakiye")
def hesap_bakiye(hesap_id: int, db: Session = Depends(get_db)):
    """Hesabın açılış və bağlanış qalığı"""
    hesap = db.query(BankaHesap).filter(BankaHesap.id == hesap_id).first()
    if not hesap:
        raise HTTPException(status_code=404, detail="Hesab tapılmadı")

    hareketler = db.query(BankaHareketi).filter(
        BankaHareketi.hesap_id == hesap_id
    ).order_by(BankaHareketi.tarixi.asc()).all()

    medaxil = sum(float(h.mebleg) for h in hareketler if h.islem_turu == IslemTuru.MEDAXIL or float(h.mebleg) > 0)
    mexaric = sum(abs(float(h.mebleg)) for h in hareketler if h.islem_turu == IslemTuru.MEXARIC or float(h.mebleg) < 0)

    return {
        "hesap_id": hesap_id,
        "sirket_adi": hesap.sirket_adi,
        "banka_adi": hesap.banka_adi,
        "iban": hesap.iban,
        "valyuta": hesap.valyuta,
        "toplam_medaxil": medaxil,
        "toplam_mexaric": mexaric,
        "net_qaliq": medaxil - mexaric,
        "son_bakiye": float(hareketler[-1].bakiye) if hareketler and hareketler[-1].bakiye else 0,
        "toplam_emeliyyat": len(hareketler),
    }

@app.get("/tum-hareketler")
def tum_hareketler(
    baslangic: Optional[str] = None,
    bitis: Optional[str] = None,
    islem_turu: Optional[str] = None,
    arama: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Bütün hesablardan hərəkətlər (axtarış və filter ilə)"""
    query = db.query(BankaHareketi)

    if baslangic:
        query = query.filter(BankaHareketi.tarixi >= datetime.strptime(baslangic, "%Y-%m-%d"))
    if bitis:
        query = query.filter(BankaHareketi.tarixi <= datetime.strptime(bitis, "%Y-%m-%d"))
    if islem_turu:
        query = query.filter(BankaHareketi.islem_turu == IslemTuru(islem_turu))
    if arama:
        query = query.filter(
            (BankaHareketi.teyinat.ilike(f"%{arama}%")) |
            (BankaHareketi.acs_hesap.ilike(f"%{arama}%")) |
            (BankaHareketi.sened_no.ilike(f"%{arama}%"))
        )

    toplam = query.count()
    hareketler = query.order_by(BankaHareketi.tarixi.desc()).offset(offset).limit(limit).all()

    return {
        "toplam": toplam,
        "hareketler": [{
            "id": h.id,
            "hesap_id": h.hesap_id,
            "tarixi": h.tarixi.isoformat(),
            "islem_turu": h.islem_turu.value if isinstance(h.islem_turu, IslemTuru) else str(h.islem_turu),
            "mebleg": float(h.mebleg),
            "valyuta": h.valyuta,
            "bakiye": float(h.bakiye) if h.bakiye else None,
            "teyinat": h.teyinat,
            "acs_hesap": h.acs_hesap,
            "sened_no": h.sened_no,
            "kategori": h.kategori,
            "kaynak_dosya": h.kaynak_dosya,
        } for h in hareketler]
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
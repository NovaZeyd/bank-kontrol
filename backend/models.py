"""
Bank Kontrol Sistemi - Database Models
Azerbaycan şirketleri için banka hareketleri takibi
"""

from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, Boolean, Enum, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
from decimal import Decimal
import enum

Base = declarative_base()

class IslemTuru(enum.Enum):
    """Əməliyyat növü — Gəlir və ya xərc"""
    MEDAXIL = "medaxil"      # Gələn pul (income)
    MEXARIC = "mexaric"      # Gedən pul (expense)

class BankaHesap(Base):
    """Banka hesabı — Hər bir banka və hesab"""
    __tablename__ = "banka_hesaplari"
    
    id = Column(Integer, primary_key=True)
    sirket_adi = Column(String(200), nullable=False)  # Ruzi HP MMC
    banka_adi = Column(String(100), nullable=False)   # TuranBank, AIIB
    iban = Column(String(50), unique=True, nullable=False)  # AZ84TURA...
    hesap_numarasi = Column(String(50))
    valyuta = Column(String(3), default="AZN")
    voen = Column(String(20))  # 3102780631
    acilis_tarihi = Column(DateTime)
    aktif = Column(Boolean, default=True)
    olusturma_tarihi = Column(DateTime, default=datetime.now)
    
    # İlişkiler
    hareketler = relationship("BankaHareketi", back_populates="hesap", cascade="all, delete-orphan")

class BankaHareketi(Base):
    """Banka hareketi — Hər bir əməliyyat"""
    __tablename__ = "banka_hareketleri"
    
    id = Column(Integer, primary_key=True)
    hesap_id = Column(Integer, ForeignKey("banka_hesaplari.id"), nullable=False)
    
    # Əməliyyat məlumatları
    tarixi = Column(DateTime, nullable=False)
    islem_turu = Column(Enum(IslemTuru), nullable=False)
    mebleg = Column(Numeric(15, 2), nullable=False)  # Əsl məbləğ
    valyuta = Column(String(3), default="AZN")
    azn_degeri = Column(Numeric(15, 2))  # AZN qarşılığı (fərqli valyuta varsa)
    bakiye = Column(Numeric(15, 2))  # Əməliyyat sonrası qalıq
    
    # Sənəd məlumatları
    sened_no = Column(String(100))  # Sənədin nömrəsi
    acs_hesap = Column(String(200))  # Əks hesab adı (göndərən/alan)
    acs_iban = Column(String(50))  # Əks hesab IBAN
    acs_voen = Column(String(20))  # Əks hesab VÖEN
    
    # Təyinat və açıqlama
    teyinat = Column(Text)  # Təyinat (uzun açıqlama)
    kategori = Column(String(100))  # Kategoriya (məs: İcarə, Maaş, ƏDV vs.)
    
    # PDF/Excel kaynağı
    kaynak_dosya = Column(String(255))  # Yüklənən fayl adı
    kaynak_satir = Column(Integer)  # Xmlfdəki sətir nömrəsi
    
    # Meta
    notlar = Column(Text)
    arsiv = Column(Boolean, default=False)
    olusturma_tarihi = Column(DateTime, default=datetime.now)
    
    # İlişki
    hesap = relationship("BankaHesap", back_populates="hareketler")

class Rapor(Base):
    """İdxal edilən raporlar"""
    __tablename__ = "raporlar"
    
    id = Column(Integer, primary_key=True)
    hesap_id = Column(Integer, ForeignKey("banka_hesaplari.id"))
    rapor_turu = Column(String(50))  # aylıq, illik, günlük
    baslangic_tarihi = Column(DateTime)
    bitis_tarihi = Column(DateTime)
    medaxil_toplam = Column(Numeric(15, 2), default=Decimal('0'))
    mexaric_toplam = Column(Numeric(15, 2), default=Decimal('0'))
    cari_qaliq = Column(Numeric(15, 2), default=Decimal('0'))
    dosya_yolu = Column(String(500))
    olusturma_tarihi = Column(DateTime, default=datetime.now)

class Rehber(Base):
    """Mail/WhatsApp göndəriləcək şəxslər"""
    __tablename__ = "rehber"
    
    id = Column(Integer, primary_key=True)
    ad_soyad = Column(String(200), nullable=False)
    email = Column(String(200))
    telefon = Column(String(20))  # WhatsApp nömrəsi (+994...)
    pozisya = Column(String(100))
    aktif = Column(Boolean, default=True)
    varsayilan = Column(Boolean, default=False)  # Avtomatik göndər
    olusturma_tarihi = Column(DateTime, default=datetime.now)

class Kullanici(Base):
    """Sistem istifadəçiləri"""
    __tablename__ = "kullanicilar"
    
    id = Column(Integer, primary_key=True)
    kullanici_adi = Column(String(100), unique=True, nullable=False)
    sifre_hash = Column(String(255), nullable=False)
    ad = Column(String(100))
    soyad = Column(String(100))
    rol = Column(String(20), default="kullanici")  # admin, kullanici
    son_giris = Column(DateTime)
    aktif = Column(Boolean, default=True)

# Database engine oluşturma fonksiyonu
def create_engine_from_url(database_url: str):
    return create_engine(database_url)

def create_tables(engine):
    Base.metadata.create_all(engine)

def get_session_maker(engine):
    return sessionmaker(bind=engine)

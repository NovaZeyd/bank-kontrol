"""
Banka PDF Ekstre Parser
TuranBank və AIIB formatları üçün
"""

import PyPDF2
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from models import BankaHareketi, IslemTuru, BankaHesap
from typing import List, Optional, Dict
import io


class PDFBankaParser:
    """Banka PDF çıxarışlarını emal edən əsas klas"""
    
    @staticmethod
    def parse_pdf_content(pdf_bytes: bytes) -> str:
        """PDF faylından test çıxarır"""
        pdf_file = io.BytesIO(pdf_bytes)
        reader = PyPDF2.PdfReader(pdf_file)
        
        full_text = ""
        for page in reader.pages:
            full_text += page.extract_text() + "\n"
        
        return full_text
    
    @staticmethod
def detect_bank_type(text: str) -> str:
        """Banka tipini təyin edir (TuranBank vs AIIB)"""
        if "turanbank.az" in text.lower() or "turanbank" in text.lower():
            return "turanbank"
        elif "a i i b" in text.lower() or "aiib" in text.lower():
            return "aiib"
        elif "investisiya" in text.lower():
            return "aiib"
        return "unknown"
    
    @classmethod
    def parse_turanbank(cls, text: str) -> Dict:
        """TuranBank PDF formatını emal edir"""
        lines = text.split('\n')
        
        # Hesab məlumatları
        hesap_info = {
            "sirket_adi": None,
            "iban": None,
            "voen": None,
            "acilis_bakiye": None,
            "kapanis_bakiye": None,
            "valyuta": "AZN",
            "banka_adi": "TuranBank"
        }
        
        hareketler = []
        
        for i, line in enumerate(lines):
            # Şirkət adı
            if "Müştərinin adı" in line and "Ruzi" in text:
                match = re.search(r'Ruzi HP MMC', text)
                if match:
                    hesap_info["sirket_adi"] = "Ruzi HP MMC"
            
            # IBAN
            if "IBAN" in line:
                match = re.search(r'AZ\d{2}TURA\d+', text)
                if match:
                    hesap_info["iban"] = match.group()
            
            # VÖEN
            if "VÖEN" in line:
                match = re.search(r'VÖEN\s+(\d+)', text)
                if match:
                    hesap_info["voen"] = match.group(1)
            
            # Günün qalığı
            if "Günün əvvəlinə qalıq" in line:
                match = re.search(r'([\d,]+\.\d{2})', line)
                if match:
                    bakiye_str = match.group(1).replace(',', '')
                    hesap_info["acilis_bakiye"] = Decimal(bakiye_str)
            
            if "Günün sonuna qalıq" in line:
                match = re.search(r'([\d,]+\.\d{2})', line)
                if match:
                    bakiye_str = match.group(1).replace(',', '')
                    hesap_info["kapanis_bakiye"] = Decimal(bakiye_str)
        
        # Funksiyonu salire haline getir
        return hesap_info
    
    @classmethod
    def parse_aiib(cls, text: str) -> Dict:
        """AIIB (Azerbaijan Investment Bank) formatını emal edir"""
        hesap_info = {
            "sirket_adi": None,
            "iban": None,
            "voen": None,
            "acilis_bakiye": None,
            "kapanis_bakiye": None,
            "valyuta": "AZN",
            "banka_adi": "AIIB"
        }
        
        hareketler = []
        
        for line in text.split('\n'):
            # Şirkət adı
            if 'RUZİ HP' in line and 'MƏHDUD' in line:
                hesap_info["sirket_adi"] = "RUZİ HP MƏHDUD MƏSULİYYƏTLİ CƏMİYYƏTİ"
            
            # IBAN
            if line.startswith('AZ31AIIB'):
                hesap_info["iban"] = line.strip()
            elif 'AZ31AIIB' in line:
                match = re.search(r'AZ31AIIB\w+', line)
                if match:
                    hesap_info["iban"] = match.group()
            
            # İlkin qalıq
            if "İlkin qalıq" in line or "İlkin qal" in line:
                match = re.search(r'([\d,\.]+)\s+AZN', line)
                if match:
                    val = match.group(1).replace(',', '')
                    hesap_info["acilis_bakiye"] = Decimal(val)
            
            # Son qalıq
            if "Son qal" in line or "Son qalıq" in line:
                match = re.search(r'([\d,\.]+)\s+AZN', line)
                if match:
                    val = match.group(1).replace(',', '')
                    hesap_info["kapanis_bakiye"] = Decimal(val)
            
            # VÖEN
            if re.match(r'.*\d{10}.*$', line):
                match = re.search(r'(\d{10})', line)
                if match:
                    voen = match.group(1)
                    if len(voen) == 10:
                        hesap_info["voen"] = voen
        
        return hesap_info
    
    @classmethod
    def parse_transactions(cls, text: str, bank_type: str) -> List[Dict]:
        """PDF-dən əməliyyatları çıxarır"""
        hareketler = []
        
        if bank_type == "turanbank":
            hareketler = cls._parse_turanbank_transactions(text)
        elif bank_type == "aiib":
            hareketler = cls._parse_aiib_transactions(text)
        
        return hareketler
    
    @classmethod
    def _parse_turanbank_transactions(cls, text: str) -> List[Dict]:
        """TuranBank əməliyyatlarını test formasından çıxarır"""
        hareketler = []
        
        # Tarix formatı: 2026-02-19
        # Satır formatı: Tarix Hesab Nömrəsi Məbləğ Qalıq Valyuta Təyinat
        
        lines = text.split('\n')
        in_table = False
        
        for line in lines:
            # Tarix formatına uyğun satırları tap
            tarih_match = re.search(r'(\d{4}-\d{2}-\d{2})', line)
            
            if tarih_match and 'AZ84TURA' in line:
                try:
                    # Məbləği tap (+/-)
                    mebleg_match = re.search(r'(-?\d+\.?\d*)\s+\d+\.\d+\s+AZN', line)
                    if mebleg_match:
                        mebleg = Decimal(mebleg_match.group(1))
                        
                        # Qalığı tap
                        qaliq_match = re.findall(r'(-?\d+\.?\d*)\s+AZN', line)
                        if len(qaliq_match) >= 2:
                            qaliq = Decimal(qaliq_match[-2])
                        
                        # Təyinatı çıxar
                        teyinat = ""
                        if 'Internet Banking' in line:
                            teyinat = "İnternet Bankçılıq"
                        elif 'Konvertasiya' in line:
                            teyinat = "Konvertasiya komissiyası"
                        
                        hareket = {
                            "tarixi": tarih_match.group(1),
                            "mebleg": mebleg,
                            "islem_turu": IslemTuru.MEXARIC if mebleg < 0 else IslemTuru.MEDAXIL,
                            "bakiye": qaliq if 'qaliq' in locals() else None,
                            "teyinat": teyinat,
                            "valyuta": "AZN"
                        }
                        hareketler.append(hareket)
                        
                except (InvalidOperation, Exception) as e:
                    continue
        
        return hareketler
    
    @classmethod
    def _parse_aiib_transactions(cls, text: str) -> List[Dict]:
        """AIIB əməliyyatlarını emal edir"""
        hareketler = []
        
        lines = text.split('\n')
        
        for i, line in enumerate(lines):
            # Tarix formatı: DD/MM/YYYY
            tarih_match = re.search(r'(\d{2}/\d{2}/\d{4})', line)
            
            if tarih_match and ('AZ' in line or any(x in line for x in ['KAPITAL', 'NAFA', 'CATER', 'AZN'])):
                try:
                    # Sətri analiz et
                    parts = line.split()
                    
                    # Tarixi tap
                    tarixi_str = tarih_match.group(1)
                    tarixi = datetime.strptime(tarixi_str, "%d/%m/%Y")
                    
                    # Məbləği tap (son AZN dəyəri)
                    meblegler = re.findall(r'(\d{2,}[\s,]?\d{0,3}\.\d{2})\s+AZN', line)
                    if meblegler:
                        mebleg_str = meblegler[-1].replace(' ', '').replace(',', '')
                        mebleg = Decimal(mebleg_str)
                        
                        # Balansı tap
                        balans_match = re.search(r'(\d{2,}[\s,]?\d{0,3}\.\d{2})\s*$', line)
                        balans = Decimal(balans_match.group(1).replace(' ', '').replace(',', '')) if balans_match else None
                        
                        # Əks hesabı tap
                        acs_match = re.search(r'/\s*([^/]+?)\s*/', line)
                        acs_hesap = acs_match.group(1).strip() if acs_match else ""
                        
                        # Təyinatı tap
                        teyinat = ""
                        if "ODƏNİŞ" in line.upper() or "ODENIS" in line.upper():
                            teyinat = "Ödəniş"
                        elif "MUQAVILE" in line.upper():
                            teyinat = "Müqavilə üzrə ödəniş"
                        elif "AniPay" in line:
                            teyinat = "AniPay transfer"
                        
                        hareket = {
                            "tarixi": tarixi_str,
                            "mebleg": mebleg,
                            "islem_turu": IslemTuru.MEDAXIL if balans and balans > Decimal('0') else IslemTuru.MEDAXIL,
                            "bakiye": balans,
                            "acs_hesap": acs_hesap,
                            "teyinat": teyinat,
                            "valyuta": "AZN",
                            "sened_no": parts[1] if len(parts) > 1 else ""
                        }
                        hareketler.append(hareket)
                        
                except Exception as e:
                    continue
        
        return hareketler
    
    @classmethod
    def full_parse(cls, pdf_content: bytes) -> Dict:
        """Tam emal - Hesab məlumatları + Əməliyyatlar"""
        text = cls.parse_pdf_content(pdf_content)
        bank_type = cls.detect_bank_type(text)
        
        if bank_type == "turanbank":
            hesap_info = cls.parse_turanbank(text)
            hareketler = cls._parse_turanbank_transactions(text)
        elif bank_type == "aiib":
            hesap_info = cls.parse_aiib(text)
            hareketler = cls._parse_aiib_transactions(text)
        else:
            hesap_info = {}
            hareketler = []
        
        return {
            "bank_type": bank_type,
            "hesap": hesap_info,
            "hareketler": hareketler,
            "toplam_medaxil": sum(h["mebleg"] for h in hareketler if h["mebleg"] > 0),
            "toplam_mexaric": sum(abs(h["mebleg"]) for h in hareketler if h["mebleg"] < 0)
        }


class ExcelExporter:
    """Banka hərəkətlərini Excel formatında ixrac edir"""
    
    @staticmethod
    def export_to_excel(hareketler: List[BankaHareketi], rapor_turu: str = "günlük") -> str:
        """
        Əməliyyatları Excel formatında ixrac edir
        Rapor türleri: günlük, aylıq, illik
        """
        import pandas as pd
        
        data = []
        for h in hareketler:
            data.append({
                "Tarix": h.tarixi.strftime("%d.%m.%Y"),
                "Əməliyyat": "Mədaxil" if h.islem_turu == IslemTuru.MEDAXIL else "Məxaric",
                "Məbləğ": float(h.mebleg),
                "Valyuta": h.valyuta,
                "AZN Dəyəri": float(h.azn_degeri) if h.azn_degeri else float(h.mebleg),
                "Qalıq": float(h.bakiye) if h.bakiye else "",
                "Təyinat": h.teyinat or "",
                "Əks Hesab": h.acs_hesap or "",
                "Sənəd Nömrəsi": h.sened_no or "",
            })
        
        df = pd.DataFrame(data)
        
        # Toplam sətrini əlavə et
        top_medaxil = sum(float(h.mebleg) for h in hareketler if h.mebleg > 0)
        top_mexaric = sum(abs(float(h.mebleg)) for h in hareketler if h.mebleg < 0)
        cari_qaliq = float(hareketler[-1].bakiye) if hareketler and hareketler[-1].bakiye else 0
        
        df.loc[len(df)] = {
            "Tarix": "TOPLAM",
            "Əməliyyat": "",
            "Məbləğ": f"Cəm Mədaxil: {top_medaxil:,.2f}",
            "Valyuta": "",
            "Qalıq": f"Cəm Məxaric: {top_mexaric:,.2f}",
        }
        
        df.loc[len(df)] = {
            "Tarix": "",
            "Əməliyyat": "",
            "Məbləğ": "",
            "Valyuta": "",
            "Qalıq": f"CARİ QALIQ: {cari_qaliq:,.2f}",
        }
        
        filename = f"rapor_{rapor_turu}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        df.to_excel(filename, index=False, engine='openpyxl')
        
        return filename


# Test kodu
if __name__ == "__main__":
    # Test məlumatları
    print("PDF Parser test edilir...")
    print("TuranBank və AIIB formatları dəstəklənir.")
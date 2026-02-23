"""
WhatsApp Rapor Gönderim Modülü
WhatsApp Web.js ilə inteqrasiya (Node.js üzerinden çalışır)
"""

import subprocess
import json
import os
from typing import List
from datetime import datetime

class WhatsAppSender:
    """WhatsApp üzerinden rapor gönderim"""
    
    def __init__(self):
        self.node_script = os.path.join(os.path.dirname(__file__), "whatsapp.js")
    
    def send_media(self, telefon: str, dosya_yolu: str, mesaj: str = None) -> bool:
        """WhatsApp ilə media + mesaj göndər"""
        try:
            # Node.js scriptini çalıştır
            cmd = [
                "node", 
                self.node_script,
                "send",
                telefon,
                dosya_yolu
            ]
            if mesaj:
                cmd.append(mesaj)
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            return result.returncode == 0
            
        except Exception as e:
            print(f"WhatsApp hatası: {e}")
            return False
    
    def send_bulk(self, telefonlar: List[str], dosya_yolu: str, mesaj: str = None) -> dict:
        """Birdən çox nömrəyə göndər"""
        basarili = 0
        basarisiz = 0
        
        for telefon in telefonlar:
            if self.send_media(telefon, dosya_yolu, mesaj):
                basarili += 1
            else:
                basarisiz += 1
        
        return {
            "toplam": len(telefonlar),
            "basarili": basarili,
            "basarisiz": basarisiz,
            "gonderim_tarihi": datetime.now().isoformat()
        }

# Node.js script (whatsapp.js) - Bu ayrı bir dosya olarak oluşturulmalı
WHATSAPP_JS_TEMPLATE = '''
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './whatsapp-session'
    }),
    puppeteer: {
        headless: true
    }
});

// QR kodunu göster
client.on('qr', (qr) => {
    console.log('QR_KOD:', qr);
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp hazır!');
});

// Terminalden komut al
const args = process.argv.slice(2);
const command = args[0];

if (command === 'send') {
    const telefon = args[1];
    const dosya = args[2];
    const mesaj = args[3] || 'Banka raporu';
    const chatId = telefon.includes('@c.us') ? telefon : `${telefon}@c.us`;
    
    client.on('ready', async () => {
        try {
            const MediaMessage = require('whatsapp-web.js').MessageMedia;
            const mime = require('mime-types');
            const base64 = fs.readFileSync(dosya, { encoding: 'base64' });
            const mimetype = mime.lookup(dosya) || 'application/octet-stream';
            const media = new MediaMessage(mimetype, base64, path.basename(dosya));
            
            await client.sendMessage(chatId, mesaj);
            await client.sendMessage(chatId, media);
            
            console.log('BASARILI');
            process.exit(0);
        } catch (err) {
            console.error('HATA:', err.message);
            process.exit(1);
        }
    });
}

client.initialize();
'''

def create_whatsapp_js():
    """whatsapp.js dosyasını yarat"""
    with open("whatsapp.js", "w") as f:
        f.write(WHATSAPP_JS_TEMPLATE)
    
    # package.json yarat
    package_json = {
        "name": "bank-kontrol-whatsapp",
        "version": "1.0.0",
        "dependencies": {
            "whatsapp-web.js": "^1.23.0",
            "qrcode-terminal": "^0.12.0",
            "puppeteer": "^21.0.0",
            "mime-types": "^2.1.35"
        }
    }
    
    with open("package.json", "w") as f:
        json.dump(package_json, f, indent=2)

if __name__ == "__main__":
    print("WhatsApp sender modülü")
    # Test için

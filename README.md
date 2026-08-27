# Kelimeli Online Server v0.7.0

App Store Review 2.1(a) için sağlamlaştırılmış Kelimeli online sunucusu.

## Bu sürümde

- `/health` ve `/ready` endpointleri sunucunun gerçekten ayakta olduğunu doğrular.
- Health cevabı `version`, `instanceId`, `startedAt`, `uptimeSeconds` ve `sessionSecretPersistent` alanlarını içerir.
- Socket.IO polling + WebSocket desteği devam eder.
- Engine.IO bağlantı hataları ile özel oda oluşturma/katılma işlemleri sunucu loglarına yazılır.
- Proxy/uzun bağlantılar için HTTP keep-alive ve header timeout değerleri ayarlanmıştır.
- SIGTERM/SIGINT sırasında düzgün kapanış eklenmiştir.
- `SESSION_SECRET` hâlâ verilmezse sunucu çalışır; fakat production'da MUTLAKA sabit bir secret verilmelidir.

## Dokploy için zorunlu ayarlar

- Tek replica kullanın: **1 replica**. Oda durumu RAM'de tutulduğu için birden fazla replica kullanmayın.
- Container port: **3000**.
- Restart policy: **Always** veya **Unless stopped**.
- Health path: **/health**.
- HTTPS açık olmalı.
- Production environment içine `SESSION_SECRET` ekleyin. Örnek üretim: `openssl rand -hex 32`.

## Deploy sonrası kontrol

Aşağıdaki adres tarayıcıda açılmalı:

`https://SUNUCU-ADRESIN/health`

Beklenen temel cevap:

```json
{
  "ok": true,
  "ready": true,
  "service": "kelimeli-online",
  "version": "0.7.0",
  "sessionSecretPersistent": true
}
```

`sessionSecretPersistent` false ise Dokploy Environment bölümünde `SESSION_SECRET` eksiktir.

Ardından:

`https://SUNUCU-ADRESIN/test`

sayfasını açıp iki ayrı tarayıcı/cihazla özel oda oluşturma ve oda koduyla katılma testi yapın.

## App Store için domain

Eski `sslip.io` adresi teknik olarak çalışabilir; ancak App Review'da sunucuya erişilememe sorunu tekrarlandığı için production'da sabit bir alan adı/subdomain kullanılması önerilir (ör. `online.senin-domainin.com`). Domain Dokploy'da aynı uygulamanın 3000 portuna yönlendirilmelidir.

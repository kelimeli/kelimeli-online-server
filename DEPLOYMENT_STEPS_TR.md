# Dokploy yayınlama sırası

1. GitHub'daki Kelimeli online server reposunda mevcut dosyaları bu ZIP içindeki dosyalarla değiştir ve commit/push yap.
2. Dokploy > Kelimeli server uygulamasına gir.
3. Source/Repository bölümünde doğru GitHub repo ve `main` branch seçili olsun.
4. Build yöntemi Dockerfile olsun. Dockerfile yolu repo kökünde `Dockerfile`.
5. Environment bölümünde `PORT=3000` ekle.
6. Environment bölümünde `SESSION_SECRET` için uzun ve sabit bir değer ekle. Bu değer deploylar arasında değişmemeli.
7. Replicas/Instances değerini **1** yap.
8. Restart policy'yi **Always** veya **Unless stopped** yap.
9. Domain bölümünde production adresini bağla ve container port olarak **3000** seç. HTTPS/Let's Encrypt açık olsun.
10. Health check varsa path `/health`, port `3000` kullan.
11. Deploy/Save & Deploy yap.
12. Deploy tamamlanınca tarayıcıdan `https://DOMAIN/health` aç. `ok:true`, `version:"0.7.0"`, `sessionSecretPersistent:true` görmeden iOS buildini gönderme.
13. `https://DOMAIN/test` aç. İki cihaz/tarayıcıyla bir cihazda özel oda kur, diğerinde 6 haneli kodla katıl.
14. Eğer domain değiştiyse Xcode projesinde `Kelimeli/Info.plist` içindeki `KelimeliOnlineOrigin` değerini aynı HTTPS adresiyle değiştir. Sonda `/` olmasın.

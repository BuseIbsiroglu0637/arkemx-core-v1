# arkemx-core-v1

ARKEMX CORE-V1 özel kaynak kod deposu.

## v152 yüklemesi (GitHub Codespaces)

1. **Code > Codespaces > Create codespace on main** üzerinden çalışma alanı oluştur.
2. `ARKEMX_v152_GitHub_Codespaces_Hazir_Kaynak.zip` dosyasını indirip Codespaces'in dosya gezginine sürükle.
3. Codespaces terminalinde sırayla çalıştır:

```bash
unzip -o ARKEMX_v152_GitHub_Codespaces_Hazir_Kaynak.zip -d .
rm ARKEMX_v152_GitHub_Codespaces_Hazir_Kaynak.zip
git add -A
git commit -m "ARKEMX v152 kaynak kodu ve kurulum duzeltmeleri"
git push origin main
npm ci
npm run dev -- --host 0.0.0.0
```

4. **Ports > 5173** üzerinden uygulamayı özel önizlemede aç. İkinci terminalde `npm run smoke:routes` çalıştır ve `test-results/smoke-static-routes.csv` sonucunu incele.

**Önemli:** HTTP rota kontrolü, 58 ekranın gerçek tarayıcı testi değildir. Dinamik rotalar ve kullanıcı etkileşimleri ayrıca test edilmelidir. Şifreleri ve `.env` dosyalarını GitHub'a yükleme.

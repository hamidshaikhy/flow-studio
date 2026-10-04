# انتشار اختیاری در GitHub Pages

این پروژه به حساب ChatGPT یا تمدید اشتراک آن برای اجرا یا میزبانی وابسته نیست. برای انتشار، فایل‌های `dist/` کافی‌اند. کد فعلی منتشر یا به حساب GitHub منتقل نشده است.

1. یک repository در حساب خودت بساز و کد پروژه را مطابق راهنمای GitHub به آن منتقل کن. `node_modules`، `dist` و فایل‌های تست موقت را commit نکن.
2. در Settings → Pages، منبع انتشار را GitHub Actions انتخاب کن.
3. فایل نمونهٔ پایین را به `.github/workflows/pages.yml` اضافه کن. فقط وقتی خودت تصمیم به انتشار گرفتی این کار را انجام بده.
4. workflow فایل‌های buildشده را deploy می‌کند. URL واقعی بعد از deploy در حساب خودت نمایش داده می‌شود؛ این مستندات URL فرضی ندارد.

```yaml
name: Publish static frontend
on:
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

`base: './'` مسیر assetها را نسبی می‌سازد؛ مسیریابی با hash مثل `#/history` انجام می‌شود. بنابراین به fallback سرور برای مسیرهای داخلی نیاز نیست و زیرمسیر repository پشتیبانی می‌شود. تست مرورگر، فایل‌های build واقعی را زیر `/portfolio/` ارائه و راهنما، chunkهای lazy و اجرای گردش‌کار را بررسی می‌کند.

API زنده حتی بعد از deploy تابع CORS و دسترس‌پذیری سرویس مقصد است. اطلاعات محلی از origin توسعه به origin میزبانی منتقل نمی‌شود؛ JSON گردش‌کار را export و در سایت جدید import کن.

منبع رسمی: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

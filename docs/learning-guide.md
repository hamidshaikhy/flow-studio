# راهنمای یادگیری برای ارائهٔ این پروژه

هدف این راهنما این است که بتوانی تصمیم‌ها و جریان واقعی داده را توضیح بدهی، خطا را پیدا کنی و کد تولیدشده با کمک AI را تغییر بدهی.

## state در React و Zustand

`src/app/store.ts` را از `useApp` شروع کن. workflow سند قابل ویرایش، selected انتخاب UI و run خروجی موتور است. `edit` از سند clone می‌گیرد؛ تغییر درجا روی همان reference انجام نمی‌دهد. revision و صف ذخیره را دنبال کن: چرا تکمیل ذخیرهٔ نسخهٔ قبلی نباید وضعیت نسخهٔ جدید را Saved کند؟

در `Editor.tsx` انتخابگرهایی مثل `useApp(s => s.workflow)` را پیدا کن. به جای subscription روی کل store، فقط بخش موردنیاز را می‌گیرند. positions موقع drag محلی است و پایان drag به سند تبدیل می‌شود. `useMemo` ساخت دادهٔ بوم را به ورودی‌های مرتبط محدود می‌کند؛ این ادعای benchmark یا حذف همهٔ rerenderها نیست.

## hook، effect و ref

در `App.tsx` effect پوسته را با document هماهنگ می‌کند؛ effect دیگر hash و میانبر را subscribe می‌کند و در cleanup listenerها را برمی‌دارد. effect برای محاسبهٔ نتیجهٔ فیلتر استفاده نشده؛ آن کار تابع خالص در `data.ts` است.

در `components/ui.tsx`، ref پنجرهٔ dialog به عنصر واقعی مرورگر اشاره دارد. `showModal` focus و پس‌زمینهٔ modal را مدیریت می‌کند؛ cleanup focus قبلی را برمی‌گرداند. در Editor، ref مربوط به resize اطلاعات gesture را نگه می‌دارد، چون تغییر خودش دلیل render نیست.

## TypeScript و config

در `model.ts`، `Config` یک discriminated union است. با `c.type === 'http'`، TypeScript می‌داند url و method وجود دارند؛ config مرتب‌سازی آن فیلدها را ندارد. همین انواع از Zod schemaها استخراج می‌شوند تا تعریف runtime و compile-time از هم جدا و ناسازگار نشوند.

`Inspector.tsx` برای هر نوع config یک فرم دارد. JsonField متن موقت و خطای parse را در React نگه می‌دارد؛ JSON نامعتبر به سند commit نمی‌شود. `false`، صفر و null با undefined فرق دارند؛ به `getPath` و DataViewer نگاه کن و توضیح بده چرا `if (!output)` بررسی درستی نیست.

## API و خطای async

`http.ts` تنها محل fetch است. `mappedRequest` دادهٔ ورودی را به query یا فیلد سطح اول body تبدیل می‌کند. AbortController داخلی برای timeout و signal بیرونی برای لغو کاربر است. finally هم timer و listener را پاک می‌کند. خطای HTTP، شبکه، مهلت، JSON و CORS احتمالی را از هم تشخیص بده؛ Failed to fetch همیشه اثبات CORS نیست.

هیچ await شبکه‌ای داخل تراکنش IndexedDB وجود ندارد. «async بودن» هم به معنی اجرای موازی بلوک‌ها نیست؛ pump ترتیبی است.

## موتور و بازیابی

در `engine.ts` از start به commit و pump برو. برای هر بلوک این سؤال را پاسخ بده: «آخرین وضعیت قابل اتکا چه زمانی ثبت شد؟» سپس `interrupted` و resume را بخوان. succeededها چرا دوباره فراخوانی نمی‌شوند؟ اگر HTTP انجام شود ولی commit نتیجه شکست بخورد، چرا current قبلی نگه داشته می‌شود؟

تست `never silently replays an uncertain write` و تست مرورگر `uncertain POST recovery requires an explicit decision` را اجرا و توضیح بده. این رفتار از مهم‌ترین بخش‌های قابل ارائهٔ پروژه است.

## تمرین‌های کوچک اما واقعی

- یک ورودی false را مستقیم به خروجی متصل کن و از Inspector و JSON دریافت‌شده نشان بده که حفظ شده است.
- الگوی شرطی را با true و false اجرا کن؛ در DevTools Network نشان بده درخواست شاخهٔ غیرفعال وجود ندارد.
- هدر یا نگاشت JSON نامعتبر وارد کن و تفاوت متن موقت با config معتبر را توضیح بده.
- هنگام Delay صفحه را تازه کن؛ تعداد درخواست‌های موفق قبلی را قبل و بعد از resume مقایسه کن.
- یک عملگر `gte` اضافه کن: ابتدا schema و تابع matches و تست معنا را تغییر بده، بعد گزینهٔ فرم و preview را به‌روز کن.
- تست گراف را با یک fan-in خراب کن و ببین چرا موتور نباید ترتیب دلخواه برای آن حدس بزند.

## موارد واقعی که هنگام بررسی اصلاح شدند

نام accessible کنترل method از متن label و optionها مبهم می‌شد؛ Field اکنون نام صریح روی کنترل native می‌گذارد. تست توانست POST را با نام دقیق پیدا کند. انتخابگرهای عمومی `.kind-http` نیز هم کارت بوم و هم کارت کتابخانه را می‌گرفتند؛ انتخابگر تست به `.flow-card.kind-http` محدود شد. خروجی قدیمی بعد از ویرایش سند از بوم کنار گذاشته شد تا اجرای snapshot قبلی با تنظیمات تازه اشتباه نشود.

برای معرفی کوتاه، بگو: «React Flow مکانیک بوم را می‌دهد. منطق محصول در موتور مستقل، اعتبارسنجی و checkpointها قابل بررسی است. AI در ساخت کمک کرده و من باید این رفتارها را بفهمم و بتوانم از طریق تست نشانشان بدهم.»

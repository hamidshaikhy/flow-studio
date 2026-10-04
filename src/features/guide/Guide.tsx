import { useState } from "react";
import {
  BookOpen,
  Database,
  Globe,
  GitBranch,
  ShieldCheck,
  Keyboard,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import { useApp, isLocked } from "../../app/store";
import { repository } from "../../lib/storage";
import { Modal } from "../../components/ui";
export function Guide() {
  const [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="page guide-page">
      <div className="page-eyebrow">ساختن با فهمیدن شروع می‌شود</div>
      <div className="page-heading">
        <div>
          <h1>
            راهنمای استودیو<span className="heading-dot">.</span>
          </h1>
          <p>قواعد ساده، رفتار شفاف و داده‌هایی که زیر نظر تو هستند.</p>
        </div>
        <BookOpen size={38} className="mint-text" />
      </div>
      <div className="guide-grid">
        <article>
          <GitBranch size={25} />
          <h2>داده چطور حرکت می‌کند؟</h2>
          <p>
            هر گردش‌کار دقیقاً یک ورودی دارد. داده از اتصال‌ها به بلوک بعدی
            می‌رود. هر بلوک یک ورودی می‌گیرد، ولی می‌تواند چند مسیر خروجی داشته
            باشد. اجرا ترتیبی است؛ حلقه و ادغام چند ورودی پشتیبانی نمی‌شود.
          </p>
          <p>
            شرط، فقط پورت «درست» یا «نادرست» را فعال می‌کند. درخواست‌های مسیر
            دیگر اجرا نمی‌شوند.
          </p>
        </article>
        <article>
          <Database size={25} />
          <h2>ادامه از آخرین نقطه</h2>
          <p>
            شروع و نتیجهٔ هر مرحله در IndexedDB ثبت می‌شود. بعد از تازه‌کردن
            صفحه، خودت ادامهٔ اجرا را انتخاب می‌کنی. خروجی‌های موفق دوباره
            محاسبه نمی‌شوند؛ مرحلهٔ نیمه‌تمام ممکن است از ابتدا تکرار شود.
          </p>
          <p>
            وقتی صفحه بسته است، هیچ پردازشی ادامه ندارد. داده متعلق به همین آدرس
            و پروفایل مرورگر است؛ پاک‌کردن دادهٔ سایت یا تغییر پورت می‌تواند
            دسترسی به آن را از بین ببرد.
          </p>
        </article>
        <article>
          <Globe size={25} />
          <h2>API زنده یا دادهٔ آزمایشی؟</h2>
          <p>
            حالت زنده یک درخواست واقعی از مرورگر می‌فرستد. سرویس باید اجازهٔ
            CORS بدهد؛ یعنی اجازه دهد این سایت پاسخ آن را بخواند. فرانت‌اند
            به‌تنهایی نمی‌تواند این مجوز را دور بزند.
          </p>
          <p>
            حالت آزمایشی از ۱۰۰ رکورد محلی استفاده می‌کند و بعد از بارگذاری
            برنامه، اینترنت لازم ندارد. نوشتن در JSONPlaceholder نمایشی است و
            رکورد دائمی ایجاد نمی‌کند.
          </p>
        </article>
        <article>
          <ShieldCheck size={25} />
          <h2>لغو و نتیجهٔ نامشخص</h2>
          <p>
            توقف، بعد از بلوک فعلی اعمال می‌شود. لغو، درخواست یا تأخیر فعلی را
            قطع می‌کند؛ اما عملیات انجام‌شده در سرور را برنمی‌گرداند.
          </p>
          <p>
            اگر POST یا درخواست نوشتن نیمه‌تمام بماند، ممکن است سرور آن را انجام
            داده باشد. برای تکرار آن یک تصمیم صریح لازم است. تضمین «دقیقاً یک
            بار» وجود ندارد.
          </p>
        </article>
        <article>
          <BookOpen size={25} />
          <h2>مسیرها و مقدارها</h2>
          <p>
            مسیر <code dir="ltr">user.name</code> یعنی فیلد name داخل user؛ مسیر
            خالی یعنی کل داده. فیلد ناموجود با null، صفر و false متفاوت است.
            مقایسهٔ عددی فقط عدد با عدد را مقایسه می‌کند.
          </p>
          <p>
            فیلتر و مرتب‌سازی آرایه می‌گیرند. مقدارهای ناموجود در مرتب‌سازی
            انتهای لیست می‌روند. خروجی جدول صفحه‌بندی دارد؛ خروجی فایل کامل است.
            پاسخ هر بلوک تا ۲ مگابایت، کل اجرا تا ۱۲ مگابایت و رویدادها تا ۵۰۰
            مورد محدودند.
          </p>
        </article>
        <article>
          <Keyboard size={25} />
          <h2>میانبرها و کنترل بوم</h2>
          <div className="shortcut-list">
            {[
              ["Ctrl / ⌘ + K", "فرمان‌ها"],
              ["Ctrl / ⌘ + Z", "بازگردانی"],
              ["Ctrl / ⌘ + Shift + Z", "انجام دوباره"],
              ["Ctrl / ⌘ + C / V", "کپی / چسباندن بلوک‌ها"],
              ["F", "نمایش همهٔ بلوک‌ها"],
              ["Delete", "حذف انتخاب"],
              ["Shift + کلیک", "انتخاب چند بلوک"],
            ].map(([key, value]) => (
              <div key={key}>
                <span>{value}</span>
                <kbd dir="ltr">{key}</kbd>
              </div>
            ))}
          </div>
          <p>
            برای افزودن بلوک روی آن کلیک کن؛ برای اتصال با صفحه‌کلید، از «اتصال
            بدون کشیدن» در تنظیمات استفاده کن.
          </p>
        </article>
      </div>
      <div className="guide-storage">
        <div>
          <h3>داده‌های این مرورگر</h3>
          <p>
            تاریخچه ابری نیست. برای نگهداری مستقل، فایل JSON گردش‌کار و خروجی‌ها
            را دریافت کن. یک اجرا در هر آدرس با Web Locks کنترل می‌شود.
          </p>
        </div>
        <button
          className="button secondary danger"
          disabled={isLocked()}
          onClick={() => setConfirm(true)}
        >
          <Trash2 size={17} /> پاک‌کردن همهٔ داده‌ها
        </button>
      </div>
      <button
        className="text-button"
        onClick={() => useApp.getState().setPage("editor")}
      >
        بازگشت به بوم <ArrowUpRight size={17} />
      </button>
      {confirm && (
        <Modal title="پاک‌کردن همهٔ داده‌ها" onClose={() => setConfirm(false)}>
          <p>
            گردش‌کارها، اجراها و ترجیحات این برنامه از مرورگر پاک شوند؟ این عمل
            قابل بازگردانی نیست.
          </p>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button
              className="button danger-button"
              onClick={async () => {
                try {
                  await repository.clearAll();
                  location.reload();
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              پاک‌کردن همهٔ داده‌ها
            </button>
            <button
              className="button secondary"
              onClick={() => setConfirm(false)}
            >
              انصراف
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

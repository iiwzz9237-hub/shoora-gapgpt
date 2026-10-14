# اتاق شورا + GapGPT

این پروژه همان فایل HTML اصلی «اتاق شورا» را نگه داشته است؛ فقط دکمهٔ «تشکیل جلسه» به API گپ‌جی‌پی‌تی از طریق بک‌اند Render وصل شده است. کلید API نباید داخل HTML یا مخزن GitHub قرار بگیرد.

## راه‌اندازی در Render

۱. فایل‌های این پوشه (`index.html`, `server.js`, `package.json`) را در ریشهٔ یک مخزن GitHub قرار دهید.

۲. در Render گزینهٔ **New → Web Service** را انتخاب کنید و مخزن را وصل کنید. نوع اجرا **Node** باشد.

۳. تنظیمات:

- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment → Add Environment Variable → Key:** `GAPGPT_API_KEY`
- **Value:** کلید API گپ‌جی‌پی‌تی شما (محرمانه)

۴. مدل به‌صورت پیش‌فرض `gpt-4o-mini` است. در صورت تفاوت شناسهٔ مدل در پنل GapGPT، متغیر اختیاری `GAPGPT_MODEL` را به شناسهٔ دقیق مدل حساب خود تغییر دهید.

۵. سایت را از آدرس **Web Service خود Render** باز کنید، نه به صورت مستقیم `index.html` و نه Render Static Site. مسیر `/health` وضعیت اولیهٔ سرور را نشان می‌دهد.

> API واقعی بدون کلید شخصی و دسترسی به مدل قابل آزمایش نهایی نیست. از سهمیهٔ API خود محافظت کنید؛ وب‌سایت عمومی ممکن است هزینه مصرف ایجاد کند.

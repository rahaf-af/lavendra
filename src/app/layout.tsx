import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import "./globals.css"; // اترك هذا كما هو (بدون تعديل)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <AntdRegistry>
          {/* هنا نتحكم في ألوان المشروع بالكامل */}
          <ConfigProvider
            direction="rtl"
            theme={{
              token: {
                colorPrimary: '#512DA8', // اللون البنفسجي حق لافندرا
                borderRadius: 8,         // حواف ناعمة للأزرار والمدخلات
              },
            }}
          >
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
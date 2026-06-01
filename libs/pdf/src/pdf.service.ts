import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '@app/prisma';

import pdfMake from 'pdfmake';

interface TFontDictionary {
  [key: string]: {
    normal: string;
    bold: string;
  };
}

@Injectable()
export class PDFService {
  private readonly logger = new Logger(PDFService.name);
  private outputDir = './upload';
  constructor(private readonly prisma: PrismaService) {
    const fontsDir = path.resolve(process.cwd(), 'fonts');
    const fonts: TFontDictionary = {
      Tajawal: {
        normal: path.join(fontsDir, 'Tajawal-Regular.ttf'),
        bold: path.join(fontsDir, 'Tajawal-Bold.ttf'),
      },
    };
    pdfMake.fonts = fonts;
  }

  async generateTicket(
    bookingId: string,
  ): Promise<{ publicUrl: string; filePath: string }> {
    const outputDir = path.resolve(this.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `ticket_${bookingId}.pdf`;
    const outputPath = path.join(outputDir, filename);
    const publicUrl = `/upload/${filename}`;

    const payment = await this.prisma.payment.findUnique({
      where: { bookingId: bookingId },
      include: {
        Booking: {
          include: {
            Trip: { include: { Bus: true } },
          },
        },
      },
    });

    if (!payment) {
      throw new Error('الحجز غير موجود');
    }

    try {
      const docDefinition = await this.buildTicketDefinition(payment);
      const pdfDoc = pdfMake.createPdf(docDefinition);
      const buffer = await pdfDoc.getBuffer();
      fs.writeFileSync(outputPath, buffer);
    } catch (error: any) {
      const errStack = error?.stack || error?.message || String(error);
      this.logger.error(
        `فشل في إنشاء ملف PDF للتذكرة ${bookingId}`,
        errStack,
      );
      fs.writeFileSync(outputPath, errStack);
    }

    return { publicUrl, filePath: outputPath };
  }

  async generatePassengerList(
    trip: any,
    bookings: any[],
  ): Promise<{ publicUrl: string; filePath: string }> {
    const outputDir = path.resolve(this.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `passengers_${trip.id}.pdf`;
    const outputPath = path.join(outputDir, filename);
    const publicUrl = `/upload/${filename}`;

    try {
      const docDefinition = this.buildPassengerListDefinition(trip, bookings);
      const pdfDoc = pdfMake.createPdf(docDefinition);
      const buffer = await pdfDoc.getBuffer();
      fs.writeFileSync(outputPath, buffer);
    } catch (error: any) {
      this.logger.error(
        `فشل في إنشاء ملف PDF لقائمة الركاب للرحلة ${trip.id}`,
        error?.stack || error?.message || error,
      );
      fs.writeFileSync(outputPath, 'PDF placeholder');
    }

    return { publicUrl, filePath: outputPath };
  }

  private async buildTicketDefinition(payment: any): Promise<any> {
    const booking = payment.Booking;
    const trip = booking.Trip;
    const bus = trip?.Bus;

    // Format Arabic date
    const formatArabicDate = (date: Date | string): string => {
      const d = new Date(date);
      return d.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    // Format Arabic time
    const formatArabicTime = (time: string): string => {
      if (!time) return '—';
      const [hours, minutes] = time.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return date.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    };

    // Format Arabic price
    const formatArabicPrice = (price: number): string => {
      return new Intl.NumberFormat('ar-EG', {
        style: 'currency',
        currency: 'SDG',
        minimumFractionDigits: 0,
      }).format(price);
    };

    // Parse bus plate JSON
    const plateData = bus?.plate
      ? typeof bus.plate === 'string'
        ? JSON.parse(bus.plate)
        : bus.plate
      : { arabic: '---', english: '---', numbers: '---' };

    // Get passengers array
    const passengers = Array.isArray(booking.passenger)
      ? booking.passenger
      : [booking.passenger || {}];

    const seatNumbers = booking.seatNumbers || [booking.seatNumber];

    // Read logo as base64
    let logoBase64 = '';
    try {
      const logoPath = path.join(
        process.cwd(),
        'backend/assets/companyLogo.png',
      );
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = logoBuffer.toString('base64');
      }
    } catch (error) {
      this.logger.warn('Logo not found, using text fallback');
    }

    // Passenger table rows
    const passengerBody = [
      [
        { text: 'الاسم', style: 'tableHeader', alignment: 'center' },
        { text: 'العمر', style: 'tableHeader', alignment: 'center' },
        { text: 'الجنس', style: 'tableHeader', alignment: 'center' },
        { text: 'رقم المقعد', style: 'tableHeader', alignment: 'center' },
      ],
    ];

    passengers.forEach((passenger: any, idx: number) => {
      passengerBody.push([
        {
          text: passenger.name || '—',
          style: 'tableCell',
          alignment: 'center',
        },
        {
          text: passenger.age?.toString() || '—',
          style: 'tableCell',
          alignment: 'center',
        },
        {
          text: passenger.gender === 'MALE' ? 'ذكر' : 'أنثى',
          style: 'tableCell',
          alignment: 'center',
        },
        {
          text: seatNumbers[idx]?.toString() || '—',
          style: 'tableCell',
          alignment: 'center',
        },
      ]);
    });

    // Payment details table
    const platformFee = Number(payment.platformFeeAmount) || 0;
    const totalAmount = Number(payment.totalAmount);
    const companyAmount = Number(payment.companyAmount);
    const ticketPrice = Number(trip.price);

    const paymentBody = [
      [
        { text: 'البيان', style: 'tableHeader', alignment: 'center' },
        { text: 'المبلغ', style: 'tableHeader', alignment: 'center' },
      ],
      [
        { text: 'سعر التذكرة', style: 'tableCell', alignment: 'center' },
        {
          text: formatArabicPrice(ticketPrice),
          style: 'tableCell',
          alignment: 'center',
        },
      ],
      [
        { text: 'رسوم المنصة', style: 'tableCell', alignment: 'center' },
        {
          text: formatArabicPrice(platformFee),
          style: 'tableCell',
          alignment: 'center',
        },
      ],
      [
        {
          text: 'المدفوع (لشركة الحافلات)',
          style: 'tableCell',
          alignment: 'center',
        },
        {
          text: formatArabicPrice(companyAmount),
          style: 'tableCell',
          alignment: 'center',
        },
      ],
      [
        { text: 'الإجمالي المدفوع', style: 'totalCell', alignment: 'center' },
        {
          text: formatArabicPrice(totalAmount),
          style: 'totalCell',
          alignment: 'center',
        },
      ],
    ];

    return {
      pageSize: 'A5',
      pageMargins: [20, 20, 20, 20],
      defaultStyle: {
        font: 'Tajawal',
        fontSize: 9,
        alignment: 'right',
      },
      content: [
        // Header with Logo and Title
        {
          columns: [
            {
              width: 'auto',
              stack: logoBase64
                ? [
                    {
                      image: `data:image/png;base64,${logoBase64}`,
                      width: 50,
                      height: 50,
                      alignment: 'right',
                    },
                  ]
                : [{ text: '', width: 50 }],
            },
            {
              width: '*',
              text: 'رحلة',
              style: 'headerTitle',
              alignment: 'center',
            },
            {
              width: 'auto',
              text: '',
            },
          ],
          margin: [0, 0, 0, 15],
        },

        // Divider
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 2,
              lineColor: '#0D9488',
            },
          ],
          margin: [0, 0, 0, 10],
        },

        // Bus Details Section
        {
          text: 'تفاصيل الحافلة',
          style: 'sectionTitle',
          margin: [0, 10, 0, 8],
        },
        {
          stack: [
            {
              text: bus?.name || '—',
              style: 'busName',
              alignment: 'center',
            },
            {
              margin: [0, 10, 0, 10],
              columns: [
                {
                  width: '*',
                  stack: [
                    { text: 'رقم اللوحة', style: 'label', alignment: 'center' },
                    {
                      table: {
                        widths: ['*', 'auto', '*'],
                        body: [
                          [
                            {
                              text: plateData.arabic || '—',
                              style: 'plateText',
                              alignment: 'center',
                            },
                            {
                              text: '|',
                              style: 'plateText',
                              alignment: 'center',
                            },
                            {
                              text: plateData.english || '—',
                              style: 'plateText',
                              alignment: 'center',
                            },
                          ],
                          [
                            {
                              text: 'عربي',
                              style: 'plateLabel',
                              alignment: 'center',
                            },
                            {},
                            {
                              text: 'إنجليزي',
                              style: 'plateLabel',
                              alignment: 'center',
                            },
                          ],
                        ],
                      },
                      layout: 'noBorders',
                    },
                    {
                      text: plateData.numbers || '—',
                      style: 'plateNumbers',
                      alignment: 'center',
                      margin: [0, 8, 0, 0],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // Trip Details Section
        {
          text: 'تفاصيل الرحلة',
          style: 'sectionTitle',
          margin: [0, 15, 0, 8],
        },
        {
          table: {
            widths: ['*', '*'],
            body: [
              [
                {
                  stack: [
                    {
                      text: 'المغادرة',
                      style: 'subSectionTitle',
                      alignment: 'center',
                    },
                    {
                      text: trip?.fromState || '—',
                      style: 'infoText',
                      alignment: 'center',
                    },
                    {
                      text: trip?.fromCity || '—',
                      style: 'infoTextBold',
                      alignment: 'center',
                    },
                    {
                      text: trip?.fromStation || '—',
                      style: 'infoText',
                      alignment: 'center',
                    },
                    {
                      text: formatArabicDate(trip?.departureDate),
                      style: 'infoText',
                      alignment: 'center',
                    },
                    {
                      text: formatArabicTime(trip?.departureTime),
                      style: 'infoText',
                      alignment: 'center',
                    },
                  ],
                  margin: [0, 0, 0, 10],
                },
                {
                  stack: [
                    {
                      text: 'الوصول',
                      style: 'subSectionTitle',
                      alignment: 'center',
                    },
                    {
                      text: trip?.toState || '—',
                      style: 'infoText',
                      alignment: 'center',
                    },
                    {
                      text: trip?.toCity || '—',
                      style: 'infoTextBold',
                      alignment: 'center',
                    },
                    {
                      text: trip?.toStation || '—',
                      style: 'infoText',
                      alignment: 'center',
                    },
                    {
                      text: formatArabicDate(trip?.arrivalDate),
                      style: 'infoText',
                      alignment: 'center',
                    },
                    {
                      text: formatArabicTime(trip?.arrivalTime),
                      style: 'infoText',
                      alignment: 'center',
                    },
                  ],
                  margin: [0, 0, 0, 10],
                },
              ],
              [
                {
                  stack: [
                    {
                      text: 'السعر',
                      style: 'subSectionTitle',
                      alignment: 'center',
                    },
                    {
                      text: formatArabicPrice(trip?.price),
                      style: 'priceText',
                      alignment: 'center',
                    },
                  ],
                },
                {
                  stack: [
                    {
                      text: 'الحالة',
                      style: 'subSectionTitle',
                      alignment: 'center',
                    },
                    {
                      text:
                        trip?.status === 'SCHEDULED'
                          ? 'مجدولة'
                          : trip?.status === 'IN_PROGRESS'
                            ? 'قيد التنفيذ'
                            : trip?.status === 'COMPLETED'
                              ? 'مكتملة'
                              : 'ملغاة',
                      style: 'infoText',
                      alignment: 'center',
                    },
                  ],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 1,
            vLineColor: () => '#99F6E4',
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 6,
            paddingBottom: () => 6,
          },
        },

        // Passenger Details Section
        {
          text: 'بيانات الركاب',
          style: 'sectionTitle',
          margin: [0, 20, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*'],
            body: passengerBody,
          },
          layout: {
            hLineWidth: () => 1,
            hLineColor: () => '#99F6E4',
            vLineWidth: () => 1,
            vLineColor: () => '#99F6E4',
            paddingTop: () => 8,
            paddingBottom: () => 8,
          },
        },

        // Payment Details Section
        {
          text: 'تفاصيل الدفع',
          style: 'sectionTitle',
          margin: [0, 20, 0, 8],
        },
        {
          table: {
            widths: ['*', '*'],
            body: paymentBody,
          },
          layout: {
            hLineWidth: () => 1,
            hLineColor: () => '#99F6E4',
            vLineWidth: () => 1,
            vLineColor: () => '#99F6E4',
            paddingTop: () => 8,
            paddingBottom: () => 8,
          },
        },

        // Footer
        {
          text: 'يُرجى الحضور قبل موعد الانطلاق بـ 30 دقيقة',
          style: 'footer',
          alignment: 'center',
          margin: [0, 30, 0, 0],
        },
        {
          text: `رقم الحجز: ${booking.id}`,
          style: 'bookingId',
          alignment: 'center',
          margin: [0, 10, 0, 0],
        },
      ],
      styles: {
        headerTitle: {
          fontSize: 24,
          bold: true,
          color: '#0D9488',
        },
        sectionTitle: {
          fontSize: 12,
          bold: true,
          color: '#0D9488',
          margin: [0, 0, 0, 5],
        },
        subSectionTitle: {
          fontSize: 10,
          bold: true,
          color: '#0F766E',
          margin: [0, 0, 0, 8],
        },
        busName: {
          fontSize: 14,
          bold: true,
          color: '#134E4A',
        },
        label: {
          fontSize: 8,
          color: '#5EEAD4',
          margin: [0, 0, 0, 5],
        },
        plateText: {
          fontSize: 16,
          bold: true,
          color: '#134E4A',
        },
        plateLabel: {
          fontSize: 7,
          color: '#5EEAD4',
        },
        plateNumbers: {
          fontSize: 18,
          bold: true,
          color: '#0D9488',
          fillColor: '#CCFBF1',
          margin: [0, 4, 0, 4],
          padding: 4,
        },
        infoText: {
          fontSize: 9,
          color: '#0F766E',
          margin: [0, 2, 0, 2],
        },
        infoTextBold: {
          fontSize: 11,
          bold: true,
          color: '#134E4A',
          margin: [0, 2, 0, 2],
        },
        priceText: {
          fontSize: 14,
          bold: true,
          color: '#0D9488',
          margin: [0, 5, 0, 5],
        },
        tableHeader: {
          fontSize: 9,
          bold: true,
          color: '#FFFFFF',
          fillColor: '#0D9488',
        },
        tableCell: {
          fontSize: 9,
          color: '#134E4A',
        },
        totalCell: {
          fontSize: 11,
          bold: true,
          color: '#FFFFFF',
          fillColor: '#0D9488',
        },
        footer: {
          fontSize: 8,
          color: '#0F766E',
        },
        bookingId: {
          fontSize: 7,
          color: '#5EEAD4',
        },
      },
    };
  }

  private buildPassengerListDefinition(trip: any, bookings: any[]): any {
    const arabicDigits: Record<string, string> = {
      '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
      '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩',
    };
    const toArabicNum = (n: any): string => String(n).replace(/[0-9]/g, d => arabicDigits[d]);

    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
    ];

    const fmtDate = (val: any): string => {
      if (!val) return '—';
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return `${toArabicNum(d.getDate())} ${arabicMonths[d.getMonth()]} ${toArabicNum(d.getFullYear())}`;
    };

    const fmtTime = (val: any): string => {
      if (!val) return '—';
      if (val instanceof Date && !isNaN(val.getTime())) {
        return `${toArabicNum(val.getHours())}:${toArabicNum(val.getMinutes())}`;
      }
      const str = String(val);
      if (/^\d{1,2}:\d{2}/.test(str)) {
        const [h, m] = str.split(':');
        return `${toArabicNum(h)}:${toArabicNum(m)}`;
      }
      return str;
    };

    const rows = bookings.flatMap((b: any) => {
      const passengers = Array.isArray(b.passenger) ? b.passenger : [b.passenger].filter(Boolean);
      return passengers.map((p: any, i: number) => {
        const seatNumber = Array.isArray(b.seatNumbers) ? toArabicNum(b.seatNumbers[i]) : toArabicNum(b.seatNumbers);
        const genderLabel = p.gender === 'MALE' ? 'ذكر' : p.gender === 'FEMALE' ? 'أنثى' : '—';
        return { seatNumber, name: p.name || '—', age: p.age != null ? toArabicNum(p.age) : '—', gender: genderLabel };
      });
    });

    const primaryColor = '#8B5E3C';
    const primaryBg = '#F5EDE3';

    return {
      defaultStyle: { font: 'Tajawal', fontSize: 11, direction: 'rtl' },
      pageMargins: [20, 20, 20, 20],
      content: [
        { text: 'قائمة الركاب', fontSize: 18, bold: true, color: primaryColor, alignment: 'center', margin: [0, 0, 0, 8] },
        { text: `${trip.fromCity || ''} ← ${trip.toCity || ''} — ${fmtDate(trip.departureDate)} ${fmtTime(trip.departureTime)}`, alignment: 'center', fontSize: 12, color: '#374151', margin: [0, 0, 0, 16] },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*', 'auto', 'auto'],
            body: [
              [
                { text: 'رقم المقعد', fillColor: primaryColor, color: '#fff', bold: true, fontSize: 11, alignment: 'center', margin: [6, 6] },
                { text: 'الاسم', fillColor: primaryColor, color: '#fff', bold: true, fontSize: 11, alignment: 'center', margin: [6, 6] },
                { text: 'العمر', fillColor: primaryColor, color: '#fff', bold: true, fontSize: 11, alignment: 'center', margin: [6, 6] },
                { text: 'الجنس', fillColor: primaryColor, color: '#fff', bold: true, fontSize: 11, alignment: 'center', margin: [6, 6] },
              ],
              ...(rows.length > 0
                ? rows.map(r => [
                    { text: r.seatNumber, alignment: 'center', fontSize: 11, margin: [6, 4] },
                    { text: r.name, alignment: 'center', fontSize: 11, margin: [6, 4] },
                    { text: r.age, alignment: 'center', fontSize: 11, margin: [6, 4] },
                    { text: r.gender, alignment: 'center', fontSize: 11, margin: [6, 4] },
                  ])
                : [[
                    { text: 'لا يوجد ركاب', alignment: 'center', fontSize: 11, color: '#9CA3AF', colSpan: 4, margin: [6, 10] },
                    {}, {}, {},
                  ]]
              ),
            ],
          },
          layout: {
            hLineWidth: () => 1,
            hLineColor: () => '#D1D5DB',
            vLineWidth: () => 1,
            vLineColor: () => '#D1D5DB',
            fillColor: (i: number) => (i > 0 && i % 2 === 0 ? primaryBg : null),
          },
        },
        { text: `إجمالي الركاب: ${toArabicNum(rows.length)}`, alignment: 'center', fontSize: 11, color: '#6B7280', margin: [0, 12, 0, 0] },
      ],
    };
  }
}

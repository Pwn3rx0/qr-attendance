// QR-Attendance-Webapp (manual lecture code version)
// --------------------------------------------------
// ✅ Version ready for GitHub deployment
// 🔐 Each lecture uses a manual unique code (LECTURE_CODE)
// - Change LECTURE_CODE manually before each lecture (e.g., "dfwer4x")
// - QR payload includes this code
// - During scanning, attendance is recorded only if QR.lectureCode === LECTURE_CODE

import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

// 🧩 Manual code for current lecture — change this value before every session
const LECTURE_CODE = 'dfwer4x'; // <<<<<<  ✏️  Change this code each lecture

export default function QRAttendanceApp() {
  const [roster, setRoster] = useState([]);
  const [columns, setColumns] = useState([]);
  const [selectedLecture, setSelectedLecture] = useState('');
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);

  const genId = (base, idx) => `${base || 'student'}_${idx}`;

  function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const normalized = json.map((row, idx) => {
        const keys = Object.keys(row);
        let id = '';
        let name = '';
        if (keys.length > 0) {
          id = row[keys[0]]?.toString() || genId('row', idx);
          name = row[keys[1]] !== undefined ? row[keys[1]]?.toString() : row[keys[0]]?.toString();
        }
        if (!id) id = genId('row', idx);
        if (!name) name = id;
        return { __raw: row, id, name, attendance: {} };
      });
      setRoster(normalized);
      setColumns([]);
      setSelectedLecture('');
    };
    reader.readAsArrayBuffer(file);
  }

  function addLecture() {
    const date = new Date();
    const iso = date.toISOString().slice(0, 10);
    let label = `${iso}`;
    let i = 1;
    while (columns.includes(label)) label = `${iso}_${i++}`;
    setColumns((prev) => [...prev, label]);
    setSelectedLecture(label);
  }

  function generatePayload(student) {
    // Include lecture code for verification
    return JSON.stringify({ id: student.id, name: student.name, lectureCode: LECTURE_CODE });
  }

  async function startScanner() {
    if (!selectedLecture) {
      alert('اختر محاضرة أولاً (Add Lecture ثم اخترها).');
      return;
    }
    setScanning(true);
    const elementId = 'qr-reader';
    try {
      const html5Qrcode = new Html5Qrcode(elementId, { verbose: false });
      html5QrcodeScannerRef.current = html5Qrcode;
      const config = { fps: 10, qrbox: 250 };
      await html5Qrcode.start(
        { facingMode: 'environment' },
        config,
        (qrMessage) => {
          try {
            const payload = JSON.parse(qrMessage);
            if (!payload?.id || !payload?.lectureCode) return;
            if (payload.lectureCode !== LECTURE_CODE) {
              alert(`⚠️ كود المحاضرة غير مطابق!\nQR مخصص لمحاضرة أخرى.`);
              return;
            }
            markPresent(payload.id);
          } catch (err) {
            console.warn('Invalid QR payload', err);
          }
        }
      );
    } catch (err) {
      console.error('Scanner failed to start', err);
      alert('فشل الوصول للكاميرا. تأكد من إعطاء صلاحيات الكاميرا واستخدام HTTPS.');
      setScanning(false);
    }
  }

  async function stopScanner() {
    try {
      if (html5QrcodeScannerRef.current) {
        await html5QrcodeScannerRef.current.stop();
        await html5QrcodeScannerRef.current.clear();
        html5QrcodeScannerRef.current = null;
      }
    } catch {}
    setScanning(false);
  }

  function markPresent(id) {
    setRoster((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, attendance: { ...r.attendance, [selectedLecture]: true } } : r
      )
    );
  }

  function togglePresent(id, lecture) {
    setRoster((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const current = !!r.attendance?.[lecture];
          return { ...r, attendance: { ...r.attendance, [lecture]: !current } };
        }
        return r;
      })
    );
  }

  function exportExcel() {
    if (!roster.length) return;
    const headerKeys = Object.keys(roster[0].__raw || {});
    const rows = roster.map((r) => {
      const base = { ...r.__raw };
      columns.forEach((col) => {
        base[col] = r.attendance?.[col] ? '\u2713' : '';
      });
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows, { header: [...headerKeys, ...columns] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `attendance_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  useEffect(() => {
    return () => {
      if (html5QrcodeScannerRef.current) html5QrcodeScannerRef.current.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="p-6 font-sans">
      <h1 className="text-2xl font-semibold mb-2">نظام حضور باستخدام QR</h1>
      <p className="text-sm mb-4">🔐 كود المحاضرة الحالي: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{LECTURE_CODE}</span></p>

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <label className="block">
          <div className="text-sm">ارفع ملف Excel للطلاب</div>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="mt-1" />
        </label>
        <div className="flex items-end gap-2">
          <button onClick={addLecture} className="px-3 py-2 rounded shadow bg-blue-600 text-white">Add Lecture</button>
          <select value={selectedLecture} onChange={(e) => setSelectedLecture(e.target.value)} className="p-2 border rounded">
            <option value="">-- اختر محاضرة --</option>
            {columns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          {!scanning && (
            <button onClick={startScanner} className="px-3 py-2 rounded shadow bg-green-600 text-white">ابدأ المسح</button>
          )}
          {scanning && (
            <button onClick={stopScanner} className="px-3 py-2 rounded shadow bg-red-600 text-white">أوقف المسح</button>
          )}
          <button onClick={exportExcel} className="px-3 py-2 rounded shadow bg-gray-800 text-white">Export Excel</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 overflow-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="border p-2 text-left">ID</th>
                <th className="border p-2 text-left">Name</th>
                {columns.map((c) => (
                  <th key={c} className="border p-2">{c}</th>
                ))}
                <th className="border p-2">QR</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.id}>
                  <td className="border p-2 align-top">{r.id}</td>
                  <td className="border p-2 align-top">{r.name}</td>
                  {columns.map((col) => (
                    <td key={col} className="border p-2 text-center">
                      <input type="checkbox" checked={!!r.attendance?.[col]} onChange={() => togglePresent(r.id, col)} />
                    </td>
                  ))}
                  <td className="border p-2 align-top">
                    <div style={{ width: 80 }}>
                      <QRCode value={generatePayload(r)} size={80} includeMargin={false} />
                    </div>
                    <div className="text-xs mt-1">QR مخصص للكود: {LECTURE_CODE}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="p-2 border rounded mb-4">
            <h2 className="font-semibold mb-2">QR Scanner</h2>
            <div id="qr-reader" ref={scannerRef} style={{ width: '100%' }} />
            <p className="text-sm mt-2">الحالة: {scanning ? 'مسح جارٍ' : 'متوقف'}</p>
          </div>

          <div className="p-2 border rounded">
            <h3 className="font-semibold">ملخص سريع</h3>
            <p>عدد الطلاب: {roster.length}</p>
            <p>عدد المحاضرات: {columns.length}</p>
            <p>المحاضرة المختارة: {selectedLecture || '-'}</p>
            <p>الكود الحالي: {LECTURE_CODE}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

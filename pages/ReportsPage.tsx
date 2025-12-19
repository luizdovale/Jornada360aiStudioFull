
import React, { useState, useMemo, useEffect } from 'react';
import { useJourneys } from '../contexts/JourneyContext';
import { useAuth } from '../contexts/AuthContext';
import { getMonthSummary, calculateJourney, formatMinutesToHours } from '../lib/utils';
import { FileDown, Clock, Map, CalendarDays } from 'lucide-react';
import PdfPreviewModal from '../components/ui/PdfPreviewModal';

type ReportType = 'hours' | 'km';

const APP_ICON_URL = "/assets/icone_pdf.png";
const FALLBACK_ICON_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABNSURBVHgB7c6xCQAgDAVBM50zsZzO2ScWcwcJPCIg90e+237tXgMLi7CwCAutsLAIC62wsAgLrbCwCAutsLAIC62wsAgLrbCwCAutsEwdh9IBi5gJ8k4AAAAASUVORK5CYII=";

const ReportsPage: React.FC = () => {
    const { journeys, settings } = useJourneys();
    const { user } = useAuth();
    const [reportType, setReportType] = useState<ReportType>('hours');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(0);

    const monthOptions = useMemo(() => {
        const options = [];
        const today = new Date();
        const startDay = settings?.month_start_day || 1;
        for (let i = -1; i < 12; i++) {
            const ref = new Date(today.getFullYear(), today.getMonth() - i, 1);
            let start = '', end = '';
            if (reportType === 'hours') {
                const cycleStart = new Date(ref.getFullYear(), ref.getMonth() - 1, startDay);
                const cycleEnd = new Date(ref.getFullYear(), ref.getMonth(), startDay - 1);
                start = cycleStart.toISOString().split('T')[0];
                end = cycleEnd.toISOString().split('T')[0];
            } else {
                start = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString().split('T')[0];
                end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).toISOString().split('T')[0];
            }
            const label = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            options.push({ label: label.charAt(0).toUpperCase() + label.slice(1), start, end, value: i });
        }
        return options;
    }, [reportType, settings]);

    useEffect(() => {
        if (monthOptions.length > 0) {
            setSelectedOptionIndex(1);
            setStartDate(monthOptions[1].start);
            setEndDate(monthOptions[1].end);
        }
    }, [reportType, monthOptions]);

    const getBase64ImageFromURL = (url: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.setAttribute("crossOrigin", "anonymous");
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL("image/png")); }
                else resolve(FALLBACK_ICON_BASE64);
            };
            img.onerror = () => resolve(FALLBACK_ICON_BASE64);
            img.src = url + '?t=' + new Date().getTime();
        });
    };

    const generatePdf = async () => {
        const filtered = journeys.filter(j => j.date >= startDate && j.date <= endDate);
        if (!filtered.length || !settings) return alert('Sem dados no período.');
        setIsGenerating(true);
        try {
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const margin = 14;
            const iconBase64 = await getBase64ImageFromURL(APP_ICON_URL);
            
            // Header
            doc.addImage(iconBase64, 'PNG', margin, 10, 7, 7);
            doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("Jornada360", margin + 10, 15);
            doc.setFontSize(10); doc.setFont("helvetica", "normal");
            doc.text(`${user?.user_metadata?.nome || 'Usuário'} | ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`, margin, 25);

            const summary = getMonthSummary(filtered, settings);

            if (reportType === 'hours') {
                doc.setFontSize(8);
                doc.text(`Ex 50%: ${formatMinutesToHours(summary.horasExtras50)} | Ex 100%: ${formatMinutesToHours(summary.horasExtras100)} | Adic. Noturno (Hora Reduzida): ${formatMinutesToHours(summary.adicionalNoturno)}`, margin, 32);
                
                const tableColumn = ["Data", "Início", "Fim", "Refeição", "HE 50%", "HE 100%", "Noturno", "Obs"];
                const tableRows = filtered.sort((a,b) => a.date.localeCompare(b.date)).map(j => {
                    const c = calculateJourney(j, settings);
                    const d = new Date(j.date + 'T00:00:00').toLocaleDateString('pt-BR');
                    if (j.is_day_off) return [d, "FOLGA", "FOLGA", "-", "-", "-", "-", j.notes || ""];
                    
                    const mealLabel = j.is_plantao ? "PLANTÃO" : `${j.meal_start || '00:00'}-${j.meal_end || '00:00'}`;
                    return [
                        d, 
                        j.start_at, 
                        j.end_at, 
                        mealLabel, 
                        formatMinutesToHours(c.horasExtras50), 
                        formatMinutesToHours(c.horasExtras100), 
                        formatMinutesToHours(c.adicionalNoturno), 
                        j.notes || ""
                    ];
                });

                // @ts-ignore
                doc.autoTable({ 
                    head: [tableColumn], 
                    body: tableRows, 
                    startY: 36, 
                    theme: 'grid', 
                    headStyles: { fillColor: "#1E263C" },
                    styles: { fontSize: 7, halign: 'center' },
                    columnStyles: { 7: { halign: 'left' } }
                });
            } else {
                doc.setFontSize(9);
                doc.text(`Total KM: ${summary.kmRodados.toFixed(1)} km | Total Entregas: ${summary.totalDeliveries}`, margin, 32);
                
                const tableColumn = ["Data", "Veículo/RV", "Entregas", "KM Inicial", "KM Final", "Total KM"];
                const tableRows = filtered.sort((a,b) => a.date.localeCompare(b.date)).map(j => {
                    const c = calculateJourney(j, settings);
                    return [
                        new Date(j.date + 'T00:00:00').toLocaleDateString('pt-BR'), 
                        j.rv_number || "-", 
                        j.deliveries || "0", 
                        j.km_start || "0", 
                        j.km_end || "0", 
                        c.kmRodados.toFixed(1)
                    ];
                });

                // @ts-ignore
                doc.autoTable({ 
                    head: [tableColumn], 
                    body: tableRows, 
                    startY: 36, 
                    theme: 'grid', 
                    headStyles: { fillColor: "#1E263C" },
                    styles: { fontSize: 8, halign: 'center' } 
                });
            }

            setPdfPreviewUrl(doc.output("datauristring")); 
            setIsModalOpen(true);
        } catch (e) { 
            console.error(e);
            alert("Erro ao gerar PDF"); 
        } finally { 
            setIsGenerating(false); 
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-title-lg text-primary-dark">Exportar Relatório</h1>
            <div className="flex bg-gray-100 p-1 rounded-2xl">
                <button onClick={() => setReportType('hours')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${reportType === 'hours' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-200'}`}>Ponto & Horas</button>
                <button onClick={() => setReportType('km')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${reportType === 'km' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-200'}`}>KM & Entregas</button>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-soft">
                <div className="mb-4">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Selecione o Mês</label>
                    <select 
                        value={selectedOptionIndex}
                        onChange={(e) => { 
                            const idx = parseInt(e.target.value);
                            setSelectedOptionIndex(idx);
                            const o = monthOptions[idx]; 
                            setStartDate(o.start); 
                            setEndDate(o.end); 
                        }} 
                        className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50"
                    >
                        {monthOptions.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase">De</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase">Até</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
                    </div>
                </div>
                <button onClick={generatePdf} disabled={isGenerating} className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg hover:bg-primary-dark transition active:scale-95 flex items-center justify-center gap-2">
                    {isGenerating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <FileDown className="w-5 h-5" />}
                    {isGenerating ? "Gerando..." : "Gerar PDF"}
                </button>
            </div>
            <PdfPreviewModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} pdfUrl={pdfPreviewUrl} fileName={`relatorio_jornada360_${reportType}.pdf`} />
        </div>
    );
};

export default ReportsPage;

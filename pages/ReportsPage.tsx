
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
            const referenceDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
            let label = '';
            let start = '';
            let end = '';
            let isFuture = i < 0;

            if (reportType === 'hours') {
                const cycleEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), startDay - 1);
                const cycleStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, startDay);
                const monthName = referenceDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                const startStr = cycleStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                const endStr = cycleEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} (${startStr} a ${endStr})`;
                start = cycleStart.toISOString().split('T')[0];
                end = cycleEnd.toISOString().split('T')[0];
            } else {
                const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
                const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
                const monthName = referenceDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;
                start = monthStart.toISOString().split('T')[0];
                end = monthEnd.toISOString().split('T')[0];
            }
            options.push({ label, start, end, value: i, isFuture });
        }
        return options;
    }, [reportType, settings]);

    useEffect(() => {
        if (monthOptions.length > 0) {
            const today = new Date();
            const startDay = settings?.month_start_day || 1;
            let defaultIndex = today.getDate() >= startDay ? 0 : 1;
            if (reportType === 'km') defaultIndex = 1;

            if (monthOptions[defaultIndex]) {
                setSelectedOptionIndex(defaultIndex);
                setStartDate(monthOptions[defaultIndex].start);
                setEndDate(monthOptions[defaultIndex].end);
            }
        }
    }, [reportType, monthOptions, settings]); 

    const handleQuickMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const idx = parseInt(e.target.value);
        if (!isNaN(idx) && monthOptions[idx]) {
            setSelectedOptionIndex(idx);
            setStartDate(monthOptions[idx].start);
            setEndDate(monthOptions[idx].end);
        }
    };

    const filteredJourneys = useMemo(() => {
        if (!startDate || !endDate) return [];
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        return journeys.filter(j => {
            const date = new Date(j.date + 'T00:00:00');
            return date >= start && date <= end;
        });
    }, [journeys, startDate, endDate]);

    const getBase64ImageFromURL = (url: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.setAttribute("crossOrigin", "anonymous");
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    try {
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL("image/png"));
                    } catch (e) { resolve(FALLBACK_ICON_BASE64); }
                } else { resolve(FALLBACK_ICON_BASE64); }
            };
            img.onerror = () => resolve(FALLBACK_ICON_BASE64);
            img.src = url + '?t=' + new Date().getTime();
        });
    };

    const generatePdf = async () => {
        if (!filteredJourneys.length || !settings) {
            alert('Não há dados no período selecionado.');
            return;
        }

        setIsGenerating(true);
        try {
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const userName = user?.user_metadata?.nome || 'Usuário';
            const period = `${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`;
            const reportTitleText = reportType === 'hours' ? "Relatório de Horas" : "Relatório de KM";

            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 14;
            const headerY = 15;
            
            const iconBase64 = await getBase64ImageFromURL(APP_ICON_URL);
            const iconSize = 7;

            try { doc.addImage(iconBase64, 'PNG', margin, headerY - 5, iconSize, iconSize); } catch (e) {
                doc.setFillColor(200, 200, 200);
                doc.rect(margin, headerY - 5, iconSize, iconSize, 'F');
            }
            
            doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor("#0C2344");
            const appNameX = margin + iconSize + 2; doc.text("Jornada360", appNameX, headerY);
            const appNameWidth = doc.getTextWidth("Jornada360"); doc.setFont("helvetica", "normal"); doc.text(` | ${reportTitleText}`, appNameX + appNameWidth, headerY);

            doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor("#9CA3AF");
            doc.text("by luizdovaletech", pageWidth - margin, headerY, { align: "right" });

            doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor("#374151");
            doc.text(`${userName} | ${period}`, margin, headerY + 8);

            const startTableY = headerY + 18;

            if (reportType === 'hours') {
                const summary = getMonthSummary(filteredJourneys, settings);
                doc.setFontSize(10);
                doc.text(`Dias Trabalhados: ${summary.totalDiasTrabalhados}`, margin, startTableY);
                doc.text(`Extras 50%: ${formatMinutesToHours(summary.horasExtras50)}`, margin + 50, startTableY);
                doc.text(`Extras 100%: ${formatMinutesToHours(summary.horasExtras100)}`, margin + 100, startTableY);

                const tableColumn = ["Data", "Início", "Fim", "Refeição", "HE 50%", "HE 100%", "Obs"];
                const tableRows: any[] = [];
                const sorted = [...filteredJourneys].sort((a, b) => new Date(a.date + "T00:00:00").getTime() - new Date(b.date + "T00:00:00").getTime());

                sorted.forEach(journey => {
                    const calcs = calculateJourney(journey, settings);
                    const dateF = new Date(journey.date + "T00:00:00").toLocaleDateString('pt-BR');

                    if (journey.is_day_off) {
                        const style = { textColor: [220, 38, 38], fontStyle: "bold" };
                        tableRows.push([{ content: dateF, styles: style }, { content: "Folga", styles: style }, { content: "Folga", styles: style }, { content: "Folga", styles: style }, "-", "-", journey.notes || "-"]);
                    } else if (journey.is_plantao) {
                        const style = { textColor: [30, 64, 175], fontStyle: "bold" }; // Azul para Plantão
                        tableRows.push([{ content: dateF, styles: style }, "13:00", "19:00", { content: "Plantão", styles: style }, formatMinutesToHours(calcs.horasExtras50), formatMinutesToHours(calcs.horasExtras100), journey.notes || "-"]);
                    } else {
                        const meal = `${journey.meal_start?.slice(0, 5)} - ${journey.meal_end?.slice(0, 5)}`;
                        tableRows.push([dateF, journey.start_at?.slice(0, 5), journey.end_at?.slice(0, 5), meal, formatMinutesToHours(calcs.horasExtras50), formatMinutesToHours(calcs.horasExtras100), journey.notes || "-"]);
                    }
                });

                // @ts-ignore
                doc.autoTable({
                    head: [tableColumn], body: tableRows, startY: startTableY + 6, theme: "grid", headStyles: { fillColor: "#0C2344", fontSize: 8 },
                    styles: { fontSize: 8, cellPadding: 2, halign: "center" },
                    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 15 }, 2: { cellWidth: 15 }, 3: { cellWidth: 25 }, 4: { cellWidth: 20 }, 5: { cellWidth: 20 }, 6: { halign: "left", cellWidth: "auto" } },
                    didParseCell: (data: any) => {
                        if (data.row.raw && data.row.raw[1] && data.row.raw[1].content === 'Folga') data.cell.styles.fillColor = [255, 235, 235];
                        if (data.row.raw && data.row.raw[3] && data.row.raw[3].content === 'Plantão') data.cell.styles.fillColor = [239, 246, 255];
                    }
                });
            } else {
                const summary = getMonthSummary(filteredJourneys, settings);
                doc.setFontSize(11); doc.text(`Total KM Rodados: ${summary.kmRodados.toFixed(1)} km`, margin, startTableY);
                const tableColumn = ["Data", "Dia", "Veículo/RV", "KM Inicial", "KM Final", "Total KM"];
                const tableRows: any[] = [];
                const sorted = [...filteredJourneys].sort((a, b) => new Date(a.date + "T00:00:00").getTime() - new Date(b.date + "T00:00:00").getTime());
                sorted.forEach(j => {
                    const c = calculateJourney(j, settings);
                    if (c.kmRodados > 0 || (j.km_start && j.km_end)) {
                        tableRows.push([new Date(j.date + "T00:00:00").toLocaleDateString('pt-BR'), new Date(j.date + "T00:00:00").toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase(), j.rv_number || "-", j.km_start || "-", j.km_end || "-", c.kmRodados.toFixed(1)]);
                    }
                });
                // @ts-ignore
                doc.autoTable({
                    head: [tableColumn], body: tableRows, startY: startTableY + 6, theme: "grid", headStyles: { fillColor: "#1E263C", fontSize: 9 },
                    styles: { fontSize: 9, cellPadding: 3, halign: "center" },
                    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 20 }, 2: { cellWidth: 35 }, 3: { cellWidth: 30 }, 4: { cellWidth: 30 }, 5: { cellWidth: 30, fontStyle: "bold" } }
                });
            }

            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i); doc.setFontSize(8); doc.setTextColor("#BDC6D1");
                doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, 287, { align: "center" });
                doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, margin, 287);
            }

            setPdfPreviewUrl(doc.output("datauristring"));
            setIsModalOpen(true);
        } catch (err) { console.error(err); alert("Erro ao gerar PDF"); } finally { setIsGenerating(false); }
    };

    const inputStyle = "w-full mt-1 p-3 bg-white border border-gray-300 rounded-lg text-primary-dark focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark transition";
    const tabStyle = (isActive: boolean) => `flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${isActive ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-transparent'}`;

    return (
        <div className="space-y-6">
            <h1 className="text-title-lg text-primary-dark">Exportar Relatório</h1>
            <div className="flex bg-gray-100 p-1 rounded-2xl">
                <button onClick={() => setReportType('hours')} className={tabStyle(reportType === 'hours')}><Clock className="w-4 h-4" /> Ponto & Horas</button>
                <button onClick={() => setReportType('km')} className={tabStyle(reportType === 'km')}><Map className="w-4 h-4" /> Reembolso KM</button>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-soft animate-in fade-in slide-in-from-bottom-2">
                <div className="text-center mb-6">
                    <h2 className="text-lg font-bold text-primary-dark">{reportType === 'hours' ? 'Relatório de Jornada' : 'Relatório de Quilometragem'}</h2>
                    <p className="text-muted-foreground text-sm mt-1">{reportType === 'hours' ? 'Foca em horários, horas extras e intervalos.' : 'Foca estritamente nos dados de deslocamento.'}</p>
                </div>
                <div className="mb-4">
                    <label className="text-sm font-medium text-primary-dark flex items-center gap-2 mb-1"><CalendarDays className="w-4 h-4" /> Período Rápido</label>
                    <select onChange={handleQuickMonthSelect} className={inputStyle} value={selectedOptionIndex}>
                        {monthOptions.map((opt, index) => <option key={index} value={index}>{opt.label} {opt.isFuture ? '(Próximo)' : ''}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div><label className="text-sm font-medium">Início</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputStyle} /></div>
                    <div><label className="text-sm font-medium">Fim</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputStyle} /></div>
                </div>
                <div className="text-center">
                    <button onClick={generatePdf} disabled={!filteredJourneys.length || isGenerating} className="inline-flex items-center gap-2 justify-center rounded-lg bg-primary py-3 px-6 text-base font-medium text-white shadow hover:bg-primary-dark active:scale-95 disabled:bg-opacity-50 w-full sm:w-auto">
                        {isGenerating ? <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : <FileDown className="w-5 h-5" />}
                        {isGenerating ? 'Gerando...' : `Gerar PDF`}
                    </button>
                </div>
            </div>
            <PdfPreviewModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} pdfUrl={pdfPreviewUrl} fileName={`relatorio_${reportType === 'hours' ? 'horas' : 'km'}_${user?.user_metadata?.nome?.split(' ')[0]?.toLowerCase() || "motorista"}.pdf`} />
        </div>
    );
};

export default ReportsPage;

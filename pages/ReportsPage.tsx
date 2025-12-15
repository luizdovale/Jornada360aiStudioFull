
import React, { useState, useMemo, useEffect } from 'react';
import { useJourneys } from '../contexts/JourneyContext';
import { useAuth } from '../contexts/AuthContext';
import { getMonthSummary, calculateJourney, formatMinutesToHours } from '../lib/utils';
import { FileDown, Clock, Map, CalendarDays } from 'lucide-react';
import PdfPreviewModal from '../components/ui/PdfPreviewModal';

type ReportType = 'hours' | 'km';

// Ícone Principal (Versão 'lh3' é mais estável para PDFs que 'photos.fife')
const APP_ICON_URL = "https://lh3.googleusercontent.com/pw/AP1GczNGtnN0Ayiv-bkG1tG_lB6oaK_um0dlk2Yvalt-fuq5hqi8VW7Hpjuy6ca9G3xEgy2Jvu_lPODRXTJ-KQcIq920od4jxl8PdElhy41aKivVzJ6T1H1058OsYeoE6mN6nAJIsaaYHvoDMQCPg9kJJZkR=w180-h180-s-no-gm?authuser=4";

// Ícone Fallback (Base64 de um quadrado azul simples) para garantir que o PDF não quebre se o link falhar
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

    // --- Lógica de Geração de Opções de Mês ---
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

    // Seleção Inteligente Padrão
    useEffect(() => {
        if (monthOptions.length > 0) {
            const today = new Date();
            const startDay = settings?.month_start_day || 1;
            let defaultIndex = 0;

            if (reportType === 'hours') {
                if (today.getDate() >= startDay) {
                    defaultIndex = 0; 
                } else {
                    defaultIndex = 1;
                }
            } else {
                defaultIndex = 1;
            }

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

    // Função auxiliar para converter URL de imagem em Base64 para o PDF
    const getBase64ImageFromURL = (url: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            // crossOrigin é crucial, mas servidores do Google às vezes o rejeitam.
            img.setAttribute("crossOrigin", "anonymous");
            
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    try {
                        ctx.drawImage(img, 0, 0);
                        const dataURL = canvas.toDataURL("image/png");
                        resolve(dataURL);
                    } catch (e) {
                        console.warn("CORS bloqueou o acesso aos pixels da imagem (Tainted Canvas). Usando fallback.");
                        resolve(FALLBACK_ICON_BASE64);
                    }
                } else {
                    resolve(FALLBACK_ICON_BASE64);
                }
            };
            
            img.onerror = () => {
                console.warn("Erro ao carregar imagem para PDF. Usando fallback.");
                resolve(FALLBACK_ICON_BASE64);
            };
            
            // Adiciona um timestamp para tentar evitar cache antigo corrompido
            img.src = url + (url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
        });
    };

    const generatePdf = async () => {
        if (!filteredJourneys.length || !settings) {
            alert('Não há dados no período selecionado para gerar o relatório.');
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
            
            // --- CABEÇALHO PERSONALIZADO ---
            
            // Carrega ícone (ou fallback se falhar)
            const iconBase64 = await getBase64ImageFromURL(APP_ICON_URL);
            const iconSize = 7; // Tamanho do ícone em mm

            // 1. Ícone à esquerda
            try {
                doc.addImage(iconBase64, 'PNG', margin, headerY - 5, iconSize, iconSize);
            } catch (e) {
                console.error("Erro ao desenhar imagem no PDF:", e);
                // Se der erro ao desenhar, desenha um quadrado cinza no lugar
                doc.setFillColor(200, 200, 200);
                doc.rect(margin, headerY - 5, iconSize, iconSize, 'F');
            }
            
            // 2. Texto "Jornada360" (Bold) logo após o ícone
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor("#0C2344"); // Azul Escuro
            const appNameX = margin + iconSize + 2;
            doc.text("Jornada360", appNameX, headerY);
            
            // 3. Texto " | Relatório..." (Normal) logo após o nome do app
            const appNameWidth = doc.getTextWidth("Jornada360");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(14);
            doc.setTextColor("#6B7280"); // Cinza
            doc.text(` | ${reportTitleText}`, appNameX + appNameWidth, headerY);

            // 4. Assinatura "by luizdovaletech" à direita
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor("#9CA3AF"); // Cinza claro
            doc.text("by luizdovaletech", pageWidth - margin, headerY, { align: "right" });

            // Linha com Nome do Usuário e Período (abaixo do título)
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor("#374151"); // Cinza escuro
            doc.text(`${userName} | ${period}`, margin, headerY + 8);


            // --- TABELAS E DADOS ---
            const startTableY = headerY + 18;

            // ... Lógica de Hours (Ponto) ...
            if (reportType === 'hours') {
                // Resumo
                const summary = getMonthSummary(filteredJourneys, settings);
                const summaryY = startTableY;
                
                doc.setFontSize(10);
                doc.text(`Dias Trabalhados: ${summary.totalDiasTrabalhados}`, margin, summaryY);
                doc.text(`Extras 50%: ${formatMinutesToHours(summary.horasExtras50)}`, margin + 50, summaryY);
                doc.text(`Extras 100%: ${formatMinutesToHours(summary.horasExtras100)}`, margin + 100, summaryY);

                // Tabela
                const tableColumn = ["Data", "Início", "Fim", "Refeição", "HE 50%", "HE 100%", "Obs"];
                const tableRows: any[] = [];

                const sortedJourneys = [...filteredJourneys].sort(
                    (a, b) => new Date(a.date + "T00:00:00").getTime() - new Date(b.date + "T00:00:00").getTime()
                );

                sortedJourneys.forEach(journey => {
                    const calcs = calculateJourney(journey, settings);
                    const dateFormatted = new Date(journey.date + "T00:00:00").toLocaleDateString('pt-BR');

                    if (journey.is_day_off) {
                        const style = { textColor: [220, 38, 38], fontStyle: "bold" };
                        tableRows.push([
                            { content: dateFormatted, styles: style },
                            { content: "Folga", styles: style },
                            { content: "Folga", styles: style },
                            { content: "Folga", styles: style },
                            { content: "-", styles: style },
                            { content: "-", styles: style },
                            { content: journey.notes || "-", styles: {} }
                        ]);
                    } else {
                        const mealStart = journey.meal_start ? journey.meal_start.slice(0, 5) : "??:??";
                        const mealEnd = journey.meal_end ? journey.meal_end.slice(0, 5) : "??:??";
                        const mealInterval = `${mealStart} - ${mealEnd}`;

                        tableRows.push([
                            dateFormatted,
                            journey.start_at?.slice(0, 5) || "-",
                            journey.end_at?.slice(0, 5) || "-",
                            mealInterval,
                            formatMinutesToHours(calcs.horasExtras50),
                            formatMinutesToHours(calcs.horasExtras100),
                            journey.notes || "-"
                        ]);
                    }
                });

                // @ts-ignore
                doc.autoTable({
                    head: [tableColumn],
                    body: tableRows,
                    startY: summaryY + 6,
                    theme: "grid",
                    headStyles: { fillColor: "#0C2344", fontSize: 8 },
                    styles: { fontSize: 8, cellPadding: 2, halign: "center" },
                    columnStyles: { 
                        0: { cellWidth: 20 }, 
                        1: { cellWidth: 15 }, 
                        2: { cellWidth: 15 }, 
                        3: { cellWidth: 25 }, 
                        4: { cellWidth: 20 }, 
                        5: { cellWidth: 20 },
                        6: { halign: "left", cellWidth: "auto" }
                    },
                    didParseCell: function(data: any) {
                        if (data.row.raw && data.row.raw[1] && data.row.raw[1].content === 'Folga') {
                            data.cell.styles.fillColor = [255, 235, 235];
                        }
                    }
                });

            } else {
                // ... Lógica de KM ...
                const summary = getMonthSummary(filteredJourneys, settings);
                const summaryY = startTableY;

                doc.setFontSize(11);
                doc.text(`Total KM Rodados: ${summary.kmRodados.toFixed(1)} km`, margin, summaryY);

                const tableColumn = ["Data", "Dia", "Veículo/RV", "KM Inicial", "KM Final", "Total KM"];
                const tableRows: any[] = [];

                const sortedJourneys = [...filteredJourneys].sort(
                    (a, b) => new Date(a.date + "T00:00:00").getTime() - new Date(b.date + "T00:00:00").getTime()
                );

                sortedJourneys.forEach(journey => {
                    const calcs = calculateJourney(journey, settings);
                    if (calcs.kmRodados > 0 || (journey.km_start && journey.km_end)) {
                        const dateFormatted = new Date(journey.date + "T00:00:00").toLocaleDateString('pt-BR');
                        const dayName = new Date(journey.date + "T00:00:00").toLocaleDateString('pt-BR', { weekday: 'short' });
                        
                        tableRows.push([
                            dateFormatted,
                            dayName.toUpperCase(),
                            journey.rv_number || "-",
                            journey.km_start?.toString() || "-",
                            journey.km_end?.toString() || "-",
                            calcs.kmRodados.toFixed(1)
                        ]);
                    }
                });

                // @ts-ignore
                doc.autoTable({
                    head: [tableColumn],
                    body: tableRows,
                    startY: summaryY + 6,
                    theme: "grid",
                    headStyles: { fillColor: "#1E263C", fontSize: 9 },
                    styles: { fontSize: 9, cellPadding: 3, halign: "center" },
                    columnStyles: { 
                        0: { cellWidth: 25 }, 
                        1: { cellWidth: 20 }, 
                        2: { cellWidth: 35 }, 
                        3: { cellWidth: 30 }, 
                        4: { cellWidth: 30 }, 
                        5: { cellWidth: 30, fontStyle: "bold" }
                    }
                });
                
                if (tableRows.length === 0) {
                    doc.text("Nenhum registro de quilometragem encontrado para este período.", margin, summaryY + 20);
                }
            }

            // RODAPÉ COMUM
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor("#BDC6D1");
                doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, 287, { align: "center" });
                doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, margin, 287);
            }

            const uri = doc.output("datauristring");
            setPdfPreviewUrl(uri);
            setIsModalOpen(true);
        } catch (err) {
            console.error(err);
            alert("Erro ao gerar PDF");
        } finally {
            setIsGenerating(false);
        }
    };

    const inputStyle =
        "w-full mt-1 p-3 bg-white border border-gray-300 rounded-lg text-primary-dark focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark transition";

    const tabStyle = (isActive: boolean) => 
        `flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2
        ${isActive 
            ? 'bg-primary text-white shadow-md' 
            : 'bg-white text-gray-500 hover:bg-gray-50 border border-transparent'
        }`;

    return (
        <div className="space-y-6">
            <h1 className="text-title-lg text-primary-dark">Exportar Relatório</h1>

            {/* ABAS DE SELEÇÃO */}
            <div className="flex bg-gray-100 p-1 rounded-2xl">
                <button 
                    onClick={() => setReportType('hours')}
                    className={tabStyle(reportType === 'hours')}
                >
                    <Clock className="w-4 h-4" /> Ponto & Horas
                </button>
                <button 
                    onClick={() => setReportType('km')}
                    className={tabStyle(reportType === 'km')}
                >
                    <Map className="w-4 h-4" /> Reembolso KM
                </button>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-soft animate-in fade-in slide-in-from-bottom-2">
                <div className="text-center mb-6">
                    <h2 className="text-lg font-bold text-primary-dark">
                        {reportType === 'hours' ? 'Relatório de Jornada' : 'Relatório de Quilometragem'}
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        {reportType === 'hours' 
                            ? 'Foca em horários, horas extras e intervalos. Ideal para RH.' 
                            : 'Foca estritamente nos dados de deslocamento. Ideal para Financeiro.'}
                    </p>
                </div>

                {/* FILTRO DE MÊS RÁPIDO */}
                <div className="mb-4">
                    <label className="text-sm font-medium text-primary-dark flex items-center gap-2 mb-1">
                        <CalendarDays className="w-4 h-4" /> Período Rápido
                    </label>
                    <select 
                        onChange={handleQuickMonthSelect} 
                        className={inputStyle}
                        value={selectedOptionIndex}
                    >
                        {monthOptions.map((opt, index) => (
                            <option key={index} value={index}>
                                {opt.label} {opt.isFuture ? '(Próximo)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="text-sm font-medium">Data de Início</label>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                            className={inputStyle} 
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium">Data Final</label>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                            className={inputStyle} 
                        />
                    </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-xl mb-6 text-xs text-blue-800 flex items-start gap-2">
                    <div className="mt-0.5 font-bold">Nota:</div>
                    <div>
                        {reportType === 'hours' 
                            ? `As datas sugeridas seguem seu Ciclo Contábil (Dia ${settings?.month_start_day || 21}).` 
                            : `As datas sugeridas seguem o Mês Civil (Dia 1 ao dia 30/31).`}
                        Você pode alterá-las manualmente nos campos acima se desejar.
                    </div>
                </div>

                <div className="text-center">
                    <button
                        onClick={generatePdf}
                        disabled={!filteredJourneys.length || isGenerating}
                        className="inline-flex items-center gap-2 justify-center rounded-lg bg-primary py-3 px-6 text-base font-medium text-white shadow hover:bg-primary-dark active:scale-95 disabled:bg-opacity-50 w-full sm:w-auto"
                    >
                        {isGenerating ? (
                             <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                        ) : (
                             <FileDown className="w-5 h-5" />
                        )}
                        {isGenerating ? 'Gerando...' : `Gerar PDF ${reportType === 'km' ? 'de KM' : 'de Ponto'}`}
                    </button>
                    {!filteredJourneys.length && (
                        <p className="text-red-500 text-sm mt-3">Nenhum dado encontrado neste período.</p>
                    )}
                </div>
            </div>

            <PdfPreviewModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                pdfUrl={pdfPreviewUrl}
                fileName={`relatorio_${reportType === 'hours' ? 'horas_extras' : 'km_rodados'}_${user?.user_metadata?.nome?.split(' ')[0]?.toLowerCase() || "motorista"}.pdf`}
            />
        </div>
    );
};

export default ReportsPage;

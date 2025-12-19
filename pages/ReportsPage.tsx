
import React, { useState, useMemo, useEffect } from 'react';
import { useJourneys } from '../contexts/JourneyContext';
import { useAuth } from '../contexts/AuthContext';
import { getMonthSummary, calculateJourney, formatMinutesToHours } from '../lib/utils';
import { FileDown, Clock, Map, CalendarDays, AlertCircle } from 'lucide-react';
import PdfPreviewModal from '../components/ui/PdfPreviewModal';

type ReportType = 'hours' | 'km';

const ReportsPage: React.FC = () => {
    const { journeys, settings } = useJourneys();
    const { user } = useAuth();
    const [reportType, setReportType] = useState<ReportType>('hours');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(1);

    const monthOptions = useMemo(() => {
        const options = [];
        const today = new Date();
        const startDay = settings?.month_start_day || 1;
        
        for (let i = -1; i < 11; i++) {
            const ref = new Date(today.getFullYear(), today.getMonth() - i, 1);
            
            const cycleStart = new Date(ref.getFullYear(), ref.getMonth() - 1, startDay);
            const cycleEnd = new Date(ref.getFullYear(), ref.getMonth(), startDay - 1);
            
            const start = cycleStart.toISOString().split('T')[0];
            const end = cycleEnd.toISOString().split('T')[0];
            
            const label = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            options.push({ 
                label: label.charAt(0).toUpperCase() + label.slice(1), 
                start, 
                end, 
                value: i 
            });
        }
        return options;
    }, [settings]);

    useEffect(() => {
        if (monthOptions.length > 0) {
            const currentOption = monthOptions[selectedOptionIndex];
            setStartDate(currentOption.start);
            setEndDate(currentOption.end);
        }
    }, [selectedOptionIndex, monthOptions]);

    const generatePdf = async () => {
        const filtered = journeys.filter(j => j.date >= startDate && j.date <= endDate);
        
        if (!filtered.length) {
            alert('Nenhum registro encontrado para o período selecionado.');
            return;
        }

        if (!settings) {
            alert('Configurações não encontradas.');
            return;
        }

        setIsGenerating(true);
        
        try {
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            if (!jsPDF) throw new Error("Biblioteca jsPDF não carregada.");

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const margin = 14;
            const titleColor = [30, 38, 60];

            doc.setFontSize(16);
            doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
            doc.setFont("helvetica", "bold");
            doc.text("Jornada360 - Relatório de Atividades", margin, 20);

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 100, 100);
            const periodLabel = `${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`;
            doc.text(`Colaborador: ${user?.user_metadata?.nome || 'Usuário'}`, margin, 28);
            doc.text(`Período: ${periodLabel}`, margin, 33);

            const summary = getMonthSummary(filtered, settings);

            if (reportType === 'hours') {
                doc.setDrawColor(230, 230, 230);
                doc.line(margin, 38, 210 - margin, 38);
                
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
                doc.text("RESUMO DO PERÍODO:", margin, 45);
                
                doc.setFont("helvetica", "normal");
                const summaryText = `Total Trabalhado: ${formatMinutesToHours(summary.totalTrabalhado)}  |  HE 50%: ${formatMinutesToHours(summary.horasExtras50)}  |  HE 100%: ${formatMinutesToHours(summary.horasExtras100)}  |  Adic. Noturno: ${formatMinutesToHours(summary.adicionalNoturno)}`;
                doc.text(summaryText, margin, 50);

                const tableColumn = ["Data", "Início", "Fim", "Refeição", "HE 50%", "HE 100%", "Noturno", "Obs"];
                const tableRows = filtered
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(j => {
                        const c = calculateJourney(j, settings);
                        const d = new Date(j.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        if (j.is_day_off) return [d, "FOLGA", "FOLGA", "-", "-", "-", "-", j.notes || ""];
                        const mealLabel = j.is_plantao ? "PLANTÃO" : `${j.meal_start || '00:00'} - ${j.meal_end || '00:00'}`;
                        return [d, j.start_at || '00:00', j.end_at || '00:00', mealLabel, formatMinutesToHours(c.horasExtras50), formatMinutesToHours(c.horasExtras100), formatMinutesToHours(c.adicionalNoturno), j.notes || ""];
                    });

                // @ts-ignore
                doc.autoTable({ 
                    head: [tableColumn], 
                    body: tableRows, 
                    startY: 55, 
                    theme: 'grid', 
                    headStyles: { fillColor: titleColor, fontSize: 8, halign: 'center' },
                    bodyStyles: { fontSize: 7, halign: 'center' },
                    columnStyles: {
                        0: { cellWidth: 15 },
                        1: { cellWidth: 15 },
                        2: { cellWidth: 15 },
                        3: { cellWidth: 30 },
                        4: { cellWidth: 20 },
                        5: { cellWidth: 20 },
                        6: { cellWidth: 20 },
                        7: { halign: 'left' }
                    },
                    margin: { left: margin, right: margin }
                });
            } else {
                doc.setDrawColor(230, 230, 230);
                doc.line(margin, 38, 210 - margin, 38);
                
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.text("ESTATÍSTICAS DE VIAGEM:", margin, 45);
                
                doc.setFont("helvetica", "normal");
                const summaryText = `Distância Total: ${summary.kmRodados.toFixed(1)} km  |  Total de Entregas: ${summary.totalDeliveries}  |  Dias com Viagem: ${summary.totalDiasTrabalhados}`;
                doc.text(summaryText, margin, 50);

                const tableColumn = ["Data", "Veículo/RV", "Entregas", "KM Inicial", "KM Final", "Total KM", "Obs"];
                const tableRows = filtered
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(j => {
                        const c = calculateJourney(j, settings);
                        const d = new Date(j.date + 'T00:00:00').toLocaleDateString('pt-BR');
                        return [d, j.rv_number || "-", j.deliveries || "0", j.km_start || "0", j.km_end || "0", c.kmRodados.toFixed(1), j.notes || ""];
                    });

                // @ts-ignore
                doc.autoTable({ 
                    head: [tableColumn], 
                    body: tableRows, 
                    startY: 55, 
                    theme: 'grid', 
                    headStyles: { fillColor: titleColor, fontSize: 8, halign: 'center' },
                    bodyStyles: { fontSize: 7, halign: 'center' },
                    columnStyles: {
                        5: { fontStyle: 'bold' },
                        6: { halign: 'left' }
                    },
                    margin: { left: margin, right: margin }
                });
            }

            setPdfPreviewUrl(doc.output("datauristring")); 
            setIsModalOpen(true);
        } catch (e: any) { 
            console.error("Erro PDF:", e);
            alert(`Erro ao gerar o relatório: ${e.message}`); 
        } finally { 
            setIsGenerating(false); 
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-title-lg text-primary-dark">Relatórios</h1>
                <p className="text-sm text-muted-foreground">Exporte seus dados em PDF para conferência.</p>
            </div>

            {/* Seleção do Tipo de Relatório - Um ao lado do outro, mas bem espaçados */}
            <div className="flex bg-gray-100 p-1.5 rounded-2xl shadow-inner border border-gray-200">
                <button 
                    onClick={() => setReportType('hours')} 
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${reportType === 'hours' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}
                >
                    <Clock className="w-4 h-4" /> Ponto & Horas
                </button>
                <button 
                    onClick={() => setReportType('km')} 
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${reportType === 'km' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}
                >
                    <Map className="w-4 h-4" /> KM Rodado
                </button>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-soft border border-gray-100 space-y-6">
                <div>
                    <label className="text-xs font-bold text-primary-dark/60 uppercase tracking-widest mb-2 block">Referência do Mês</label>
                    <select 
                        value={selectedOptionIndex}
                        onChange={(e) => setSelectedOptionIndex(parseInt(e.target.value))} 
                        className="w-full p-4 border border-gray-200 rounded-xl bg-gray-50 font-medium text-primary-dark focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                    >
                        {monthOptions.map((o, i) => (
                            <option key={i} value={i}>{o.label}</option>
                        ))}
                    </select>
                </div>

                {/* Datas em linhas separadas conforme solicitado */}
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Início do Período</label>
                        <div className="relative">
                            <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                                className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl text-base font-medium bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Fim do Período</label>
                        <div className="relative">
                            <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl text-base font-medium bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <button 
                        onClick={generatePdf} 
                        disabled={isGenerating} 
                        className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg hover:bg-primary-dark transition active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70"
                    >
                        {isGenerating ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <FileDown className="w-5 h-5" />
                        )}
                        {isGenerating ? "Processando..." : "Gerar Relatório PDF"}
                    </button>
                </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-primary-light/50 rounded-xl border border-primary/10">
                <AlertCircle className="w-5 h-5 text-primary-dark/60 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-primary-dark/70 leading-relaxed">
                    <strong>Atenção:</strong> O PDF gerado inclui todos os registros dentro do intervalo selecionado. Para o relatório de KM, certifique-se de que os campos de odômetro foram preenchidos.
                </p>
            </div>

            <PdfPreviewModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                pdfUrl={pdfPreviewUrl} 
                fileName={`Jornada360_${reportType === 'hours' ? 'Ponto' : 'KM'}_${startDate}_${endDate}.pdf`} 
            />
        </div>
    );
};

export default ReportsPage;


import React, { useState, useMemo, useEffect } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { getMonthSummary, calculateJourney, formatMinutesToHours, getLocalDateString, addDaysToDateString, getPeriodMonthDate, formatPeriodRange, getTripLabel } from '../lib/utils';
import { FileDown, Clock, Map, Lock, Gift, ChevronDown, Info } from 'lucide-react';
import PdfPreviewModal from '../components/ui/PdfPreviewModal';

type ReportType = 'hours' | 'km';

// Relatório grátis do plano free usado no mês (1 por mês do calendário).
type FreeReportUsage = { report_type: ReportType; period_start: string; period_end: string };

const ReportsPage: React.FC = () => {
    const { journeys, settings, settingsAt, getPeriod } = useJourneys();
    const { user, isPro } = useAuth();
    const navigate = useNavigate();
    const [reportType, setReportType] = useState<ReportType>('hours');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(1);

    // Plano free: 1 relatório por mês do calendário. Baixar de novo o mesmo
    // relatório (tipo e período) não conta outro.
    const [freeUsage, setFreeUsage] = useState<FreeReportUsage | null>(null);
    const [freeUsageLoaded, setFreeUsageLoaded] = useState(false);
    const now = new Date();
    const currentMonth = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
    const currentMonthName = now.toLocaleDateString('pt-BR', { month: 'long' });
    const nextMonthName = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('pt-BR', { month: 'long' });

    useEffect(() => {
        if (!user || isPro) return;
        let cancelled = false;
        supabase
            .from('free_report_usage')
            .select('report_type, period_start, period_end')
            .eq('user_id', user.id)
            .eq('month', currentMonth)
            .maybeSingle()
            .then(({ data, error }: { data: FreeReportUsage | null, error: any }) => {
                if (cancelled) return;
                if (error) console.error('Erro ao consultar relatório grátis:', error);
                setFreeUsage(data ?? null);
                setFreeUsageLoaded(true);
            });
        return () => { cancelled = true; };
    }, [user, isPro, currentMonth]);

    const isSameAsFreeReport = !!freeUsage && freeUsage.report_type === reportType
        && freeUsage.period_start === startDate && freeUsage.period_end === endDate;
    const canGenerateFree = !isPro && freeUsageLoaded && (!freeUsage || isSameAsFreeReport);

    // Períodos contábeis com o mesmo nome usado no Início (o mês em que o
    // período começa): o próximo, o atual e os 10 anteriores. Respeita trocas
    // de dia contábil, que podem criar um período de transição mais curto.
    const monthOptions = useMemo(() => {
        if (!getPeriod) return [];
        const current = getPeriod(getLocalDateString());
        const periods = [getPeriod(addDaysToDateString(current.end, 1)), current];
        let p = current;
        for (let i = 0; i < 10; i++) {
            p = getPeriod(addDaysToDateString(p.start, -1));
            periods.push(p);
        }

        const named = periods.map(period => {
            const monthDate = getPeriodMonthDate(period);
            const label = monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            return { period, monthDate, label: label.charAt(0).toUpperCase() + label.slice(1) };
        });

        return named.map((o, i) => {
            // Dois períodos no mesmo mês (troca de dia contábil): mostra as datas.
            const repeated = named.filter(x => x.label === o.label).length > 1;
            const calendarEnd = new Date(o.monthDate.getFullYear(), o.monthDate.getMonth() + 1, 0);
            return {
                label: repeated ? `${o.label} (${formatPeriodRange(o.period)})` : o.label,
                cycleStart: o.period.start,
                cycleEnd: o.period.end,
                calendarStart: getLocalDateString(o.monthDate),
                calendarEnd: getLocalDateString(calendarEnd),
                value: i - 1,
            };
        });
    }, [getPeriod]);

    useEffect(() => {
        if (monthOptions.length > 0) {
            const currentOption = monthOptions[selectedOptionIndex];
            if (reportType === 'hours') {
                setStartDate(currentOption.cycleStart);
                setEndDate(currentOption.cycleEnd);
            } else {
                setStartDate(currentOption.calendarStart);
                setEndDate(currentOption.calendarEnd);
            }
        }
    }, [selectedOptionIndex, monthOptions, reportType]);

    const loadImage = (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject(new Error('Falha ao carregar ícone do PDF'));
            img.src = url;
        });
    };

    // Reserva o relatório grátis do mês antes de gerar. O banco aceita só um por
    // mês (unique), então vale também entre aparelhos diferentes.
    const claimFreeReport = async (): Promise<boolean> => {
        if (!user) return false;
        const usage: FreeReportUsage = { report_type: reportType, period_start: startDate, period_end: endDate };
        const { error } = await supabase
            .from('free_report_usage')
            .insert({ user_id: user.id, month: currentMonth, ...usage });
        if (!error) {
            setFreeUsage(usage);
            return true;
        }
        if (error.code === '23505') {
            const { data } = await supabase
                .from('free_report_usage')
                .select('report_type, period_start, period_end')
                .eq('user_id', user.id)
                .eq('month', currentMonth)
                .maybeSingle();
            setFreeUsage(data ?? null);
            if (data && data.report_type === usage.report_type && data.period_start === usage.period_start && data.period_end === usage.period_end) {
                return true;
            }
            alert('Você já usou seu relatório grátis deste mês em outro aparelho.');
            return false;
        }
        console.error('Erro ao reservar relatório grátis:', error);
        alert('Não foi possível liberar o relatório grátis. Tente novamente.');
        return false;
    };

    const generatePdf = async () => {
        if (!isPro && !canGenerateFree) {
            navigate('/subscription');
            return;
        }

        const filtered = journeys.filter(j => j.date >= startDate && j.date <= endDate);
        
        if (!filtered.length) {
            alert('Nenhum registro encontrado para o período selecionado.');
            return;
        }

        if (!settings || !settingsAt) {
            alert('Configurações não encontradas.');
            return;
        }

        if (!isPro && !freeUsage && !(await claimFreeReport())) {
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
            const rightMargin = 210 - margin;
            const titleColor = [30, 38, 60];
            const titleText = "Jornada360 - Relatório de Atividades";
            const signatureText = "by luizdovaletech";

            // Cabeçalho com Ícone e Assinatura
            try {
                // Tenta carregar do assets local, se falhar usa a URL remota de fallback
                let iconBase64;
                try {
                    iconBase64 = await loadImage('/assets/icone_pdf.png');
                } catch (e) {
                    iconBase64 = await loadImage('https://lh3.googleusercontent.com/pw/AP1GczMzevf3MtEhoqH_m88FmaGlcCRm7xNpg3sZTyDcPT6_I7jthzMtVudC4ZLUZ8kL7J0BB5Ahky7903UpG2CBHqPCrYduoiusu6KI7vfm0kFundAszoeMnmfgInqoa5TUCUVxmHOYwXWNbQl5OyxjJ_v8=w512-h512-s-no-gm?authuser=4');
                }
                
                doc.addImage(iconBase64, 'PNG', margin, 14, 8, 8);
                
                // Título em Negrito à esquerda
                doc.setFontSize(16);
                doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
                doc.setFont("helvetica", "bold");
                doc.text(titleText, margin + 11, 20);
                
                // Assinatura em Normal e menor à direita
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(150, 150, 150);
                doc.text(signatureText, rightMargin, 20, { align: 'right' });
                
            } catch (e) {
                // Fallback caso falhe imagem
                doc.setFontSize(16);
                doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
                doc.setFont("helvetica", "bold");
                doc.text(titleText, margin, 20);

                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(150, 150, 150);
                doc.text(signatureText, rightMargin, 20, { align: 'right' });
            }

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 100, 100);
            const periodLabel = `${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`;
            doc.text(`Colaborador: ${user?.user_metadata?.nome || 'Usuário'}`, margin, 28);
            // Empresa e nome do registro vigentes nas datas do relatório; se o período
            // atravessa uma troca de empresa, mostra os dois.
            const distinct = (values: string[]) => Array.from(new Set(values));
            const periodSettings = filtered.map(j => settingsAt(j.date));
            const companyName = distinct(periodSettings.map(st => st.company_name?.trim() || '').filter(Boolean)).join(' / ');
            const tripLabel = distinct(periodSettings.map(getTripLabel)).join(' / ');
            if (companyName) {
                // À direita, nas linhas do colaborador e do período; nomes longos
                // quebram em até 2 linhas para não encostar no texto da esquerda.
                doc.setFont("helvetica", "bold");
                doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
                const companyLines: string[] = doc.splitTextToSize(`Empresa: ${companyName}`, 90);
                if (companyLines.length > 2) {
                    companyLines[1] = doc.splitTextToSize(companyLines.slice(1).join(' '), 84)[0].trimEnd() + '...';
                }
                companyLines.slice(0, 2).forEach((line, i) => {
                    doc.text(line, rightMargin, 28 + i * 5, { align: 'right' });
                });
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 100, 100);
            }
            doc.text(`Período: ${periodLabel}`, margin, 33);
            doc.text(`Tipo: ${reportType === 'hours' ? 'Ponto e Horas Extras' : 'Controle de KM e Entregas'}`, margin, 38);

            const summary = getMonthSummary(filtered, settingsAt);
            if (reportType === 'hours') {
                const currentOption = monthOptions[selectedOptionIndex];
                const calendarFiltered = journeys.filter(j => j.date >= currentOption.calendarStart && j.date <= currentOption.calendarEnd);
                const calendarSummary = getMonthSummary(calendarFiltered, settingsAt);
                summary.totalDiasTrabalhados = calendarSummary.totalDiasTrabalhados;
            }

            if (reportType === 'hours') {
                doc.setDrawColor(230, 230, 230);
                doc.line(margin, 42, 210 - margin, 42);
                
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
                doc.text("RESUMO DO PERÍODO:", margin, 48);
                
                doc.setFont("helvetica", "normal");
                const summaryText = `Dias Trabalhados: ${summary.totalDiasTrabalhados} | HE 50%: ${formatMinutesToHours(summary.horasExtras50)}  |  HE 100%: ${formatMinutesToHours(summary.horasExtras100)}  |  Adic. Noturno: ${formatMinutesToHours(summary.adicionalNoturno)}`;
                doc.text(summaryText, margin, 53);

                const tableColumn = ["Data", tripLabel, "Início", "Fim", "Refeição", "HE 50%", "HE 100%", "Noturno", "Obs"];
                const tableRows = filtered
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(j => {
                        const c = calculateJourney(j, settingsAt(j.date));
                        const d = new Date(j.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        if (j.is_day_off) return [d, j.rv_number || "-", "FOLGA", "FOLGA", "FOLGA", "FOLGA", "FOLGA", "FOLGA", j.notes || ""];
                        const mealLabel = j.is_plantao ? "PLANTÃO" : `${j.meal_start || '00:00'} - ${j.meal_end || '00:00'}`;
                        return [d, j.rv_number || "-", j.start_at || '00:00', j.end_at || '00:00', mealLabel, formatMinutesToHours(c.horasExtras50), formatMinutesToHours(c.horasExtras100), formatMinutesToHours(c.adicionalNoturno), j.notes || ""];
                    });

                // @ts-ignore
                doc.autoTable({ 
                    head: [tableColumn], 
                    body: tableRows, 
                    startY: 58, 
                    theme: 'grid', 
                    headStyles: { fillColor: titleColor, fontSize: 8, halign: 'center' },
                    bodyStyles: { fontSize: 7, halign: 'center' },
                    columnStyles: {
                        0: { cellWidth: 15 },
                        1: { cellWidth: 12 },
                        2: { cellWidth: 15 },
                        3: { cellWidth: 15 },
                        4: { cellWidth: 25 },
                        5: { cellWidth: 18 },
                        6: { cellWidth: 18 },
                        7: { cellWidth: 18 },
                        8: { halign: 'left' }
                    },
                    didParseCell: (data: any) => {
                        if (data.cell.text && data.cell.text.includes('FOLGA')) {
                            data.cell.styles.textColor = [220, 38, 38]; // Red-600
                            data.cell.styles.fontStyle = 'bold';
                        }
                    },
                    margin: { left: margin, right: margin }
                });
            } else {
                doc.setDrawColor(230, 230, 230);
                doc.line(margin, 42, 210 - margin, 42);
                
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.text("ESTATÍSTICAS DE VIAGEM:", margin, 48);
                
                doc.setFont("helvetica", "normal");
                const summaryText = `Distância Total: ${summary.kmRodados.toFixed(1)} km  |  Total de Entregas: ${summary.totalDeliveries}  |  Dias Trabalhados: ${summary.totalDiasTrabalhados}`;
                doc.text(summaryText, margin, 53);

                const tableColumn = ["Data", tripLabel, "Entregas", "KM Inicial", "KM Final", "Total KM"];
                const tableRows = filtered
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(j => {
                        const c = calculateJourney(j, settingsAt(j.date));
                        const d = new Date(j.date + 'T00:00:00').toLocaleDateString('pt-BR');
                        if (j.is_day_off) return [d, "FOLGA", "FOLGA", "FOLGA", "FOLGA", c.kmRodados > 0 ? c.kmRodados.toFixed(1) : "FOLGA"];
                        return [d, j.rv_number || "-", j.deliveries || "0", j.km_start || "0", j.km_end || "0", c.kmRodados.toFixed(1)];
                    });

                // @ts-ignore
                doc.autoTable({ 
                    head: [tableColumn], 
                    body: tableRows, 
                    startY: 58, 
                    theme: 'grid', 
                    headStyles: { fillColor: titleColor, fontSize: 8, halign: 'center' },
                    bodyStyles: { fontSize: 7, halign: 'center' },
                    columnStyles: {
                        5: { fontStyle: 'bold' }
                    },
                    didParseCell: (data: any) => {
                        if (data.cell.text && data.cell.text.includes('FOLGA')) {
                            data.cell.styles.textColor = [220, 38, 38]; // Red-600
                            data.cell.styles.fontStyle = 'bold';
                        }
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

    const inputStyle = "block w-full h-11 px-3 border border-gray-200 rounded-lg bg-white text-sm text-primary-dark focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 outline-none transition-colors min-w-0";
    const labelStyle = "block text-xs font-medium text-gray-500 mb-1.5";
    const formatDate = (date: string, opts?: Intl.DateTimeFormatOptions) => new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', opts);
    const shortDate = (date: string) => formatDate(date, { day: '2-digit', month: '2-digit' });
    // PRO, grátis disponível ou ainda consultando: botão principal em azul.
    const unlocked = isPro || canGenerateFree || !freeUsageLoaded;
    const reportTypes = [
        { value: 'hours' as ReportType, icon: Clock, label: 'Ponto e horas' },
        { value: 'km' as ReportType, icon: Map, label: 'KM rodado' },
    ];

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-xl font-bold text-primary-dark">Relatórios</h1>
                <p className="text-sm text-gray-500 mt-0.5">Exporte seus registros em PDF.</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                    <div role="tablist" aria-label="Tipo de relatório" className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-lg">
                        {reportTypes.map(({ value, icon: Icon, label }) => (
                            <button
                                key={value}
                                type="button"
                                role="tab"
                                aria-selected={reportType === value}
                                onClick={() => setReportType(value)}
                                className={`h-9 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors
                                    ${reportType === value ? 'bg-white text-primary-dark shadow-sm' : 'text-gray-500 hover:text-primary-dark'}`}
                            >
                                <Icon className={`w-4 h-4 ${reportType === value ? 'text-blue-600' : ''}`} /> {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        <label htmlFor="report_month" className={labelStyle}>Mês de referência</label>
                        <div className="relative">
                            <select
                                id="report_month"
                                value={selectedOptionIndex}
                                onChange={(e) => setSelectedOptionIndex(parseInt(e.target.value))}
                                className={`${inputStyle} appearance-none pr-9`}
                            >
                                {monthOptions.map((o, i) => (
                                    <option key={i} value={i}>{o.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                            <label htmlFor="report_start" className={labelStyle}>Início</label>
                            <input id="report_start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputStyle} />
                        </div>
                        <div className="min-w-0">
                            <label htmlFor="report_end" className={labelStyle}>Fim</label>
                            <input id="report_end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputStyle} />
                        </div>
                    </div>

                    <p className="flex items-start gap-1.5 text-xs text-gray-500">
                        <Info className="w-3.5 h-3.5 mt-px flex-shrink-0" />
                        {reportType === 'hours'
                            ? 'O período segue o ciclo de fechamento das suas configurações.'
                            : 'O relatório de KM usa o mês do calendário (do dia 1 ao último dia).'}
                    </p>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50/70 space-y-3">
                    {!isPro && freeUsageLoaded && (
                        <p className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                            <Gift className={`w-4 h-4 flex-shrink-0 ${freeUsage ? 'text-gray-400' : 'text-blue-600'}`} />
                            {freeUsage ? (
                                <span>
                                    Relatório grátis de {currentMonthName} já usado
                                    ({freeUsage.report_type === 'hours' ? 'Ponto' : 'KM'}, {shortDate(freeUsage.period_start)} a {shortDate(freeUsage.period_end)}).
                                    Você pode baixá-lo de novo; outro, só a partir de 1º de {nextMonthName}.
                                </span>
                            ) : (
                                <span>
                                    <span className="font-medium text-primary-dark">1 relatório grátis</span> disponível em {currentMonthName}. Confira o tipo e o período antes de gerar.
                                </span>
                            )}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={generatePdf}
                        disabled={isGenerating || (!isPro && !freeUsageLoaded)}
                        className={`w-full h-11 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60
                            ${unlocked
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-white text-primary-dark border border-gray-300 hover:bg-gray-50'}`}
                    >
                        {isGenerating ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : unlocked ? (
                            <FileDown className="w-4 h-4" />
                        ) : (
                            <Lock className="w-4 h-4 text-gray-500" />
                        )}
                        {isGenerating ? "Gerando..."
                            : isPro ? "Gerar PDF"
                            : !freeUsageLoaded ? "Verificando..."
                            : canGenerateFree ? (isSameAsFreeReport ? "Baixar novamente" : "Gerar relatório grátis")
                            : "Assinar PRO para gerar"}
                    </button>

                    {!isPro && (
                        <p className="text-[11px] text-center text-gray-400">Relatórios ilimitados no plano PRO.</p>
                    )}
                </div>
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
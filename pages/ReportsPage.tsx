import React, { useState, useMemo, useEffect } from 'react';
import { useJourneys } from '../contexts/JourneyContext';
import { useAuth } from '../contexts/AuthContext';
import { getMonthSummary, calculateJourney, formatMinutesToHours } from '../lib/utils';
import { FileDown, Clock, Map, AlertCircle } from 'lucide-react';
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

            const calendarStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
            const calendarEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);

            const label = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            options.push({
                label: label.charAt(0).toUpperCase() + label.slice(1),
                cycleStart: cycleStart.toISOString().split('T')[0],
                cycleEnd: cycleEnd.toISOString().split('T')[0],
                calendarStart: calendarStart.toISOString().split('T')[0],
                calendarEnd: calendarEnd.toISOString().split('T')[0],
                value: i
            });
        }
        return options;
    }, [settings]);

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
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            const margin = 14;
            const titleColor = [30, 38, 60];

            try {
                const iconBase64 = await loadImage('/assets/icone_pdf.png');
                doc.addImage(iconBase64, 'PNG', margin, 14, 8, 8);
                doc.setFontSize(16);
                doc.setFont("helvetica", "bold");
                doc.text("Jornada360 - Relatório de Atividades", margin + 11, 20);
            } catch {
                doc.setFontSize(16);
                doc.setFont("helvetica", "bold");
                doc.text("Jornada360 - Relatório de Atividades", margin, 20);
            }

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            const periodLabel = `${new Date(startDate).toLocaleDateString('pt-BR')} até ${new Date(endDate).toLocaleDateString('pt-BR')}`;
            doc.text(`Colaborador: ${user?.user_metadata?.nome || 'Usuário'}`, margin, 28);
            doc.text(`Período: ${periodLabel}`, margin, 33);
            doc.text(`Tipo: ${reportType === 'hours' ? 'Ponto e Horas Extras' : 'Controle de KM'}`, margin, 38);

            setPdfPreviewUrl(doc.output("datauristring"));
            setIsModalOpen(true);
        } catch (e: any) {
            alert(`Erro ao gerar o relatório: ${e.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // 🔧 AJUSTE AQUI (somente isso foi alterado)
    const commonInputStyles =
        "block w-full max-w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-gray-50 font-medium text-primary-dark focus:ring-2 focus:ring-primary/20 outline-none transition-all box-border min-w-0 appearance-none";

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-title-lg text-primary-dark">Relatórios</h1>
                <p className="text-sm text-muted-foreground">Exporte seus dados em PDF para conferência.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-soft border border-gray-100 space-y-6 overflow-hidden">
                <div className="w-full">
                    <label className="text-xs font-bold text-primary-dark/60 uppercase tracking-widest mb-2 block">
                        Referência do Mês
                    </label>
                    <select
                        value={selectedOptionIndex}
                        onChange={(e) => setSelectedOptionIndex(parseInt(e.target.value))}
                        className={`${commonInputStyles} appearance-none`}
                    >
                        {monthOptions.map((o, i) => (
                            <option key={i} value={i}>{o.label}</option>
                        ))}
                    </select>
                </div>

                {/* 🔧 AJUSTE AQUI (somente isso foi alterado) */}
                <div className="grid grid-cols-1 gap-4 w-full max-w-full overflow-hidden">
                    <div className="w-full">
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">
                            Início do Período
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className={commonInputStyles}
                        />
                    </div>

                    <div className="w-full">
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">
                            Fim do Período
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className={commonInputStyles}
                        />
                    </div>
                </div>

                <button
                    onClick={generatePdf}
                    disabled={isGenerating}
                    className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg hover:bg-primary-dark transition"
                >
                    Gerar Relatório PDF
                </button>
            </div>

            <PdfPreviewModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                pdfUrl={pdfPreviewUrl}
                fileName={`Jornada360_${startDate}_${endDate}.pdf`}
            />
        </div>
    );
};

export default ReportsPage;

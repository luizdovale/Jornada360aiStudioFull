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

            setPdfPreviewUrl(doc.output("datauristring"));
            setIsModalOpen(true);
        } catch (e: any) {
            alert(`Erro ao gerar o relatório: ${e.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const commonInputStyles =
        "block w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-gray-50 font-medium text-primary-dark focus:ring-2 focus:ring-primary/20 outline-none transition-all box-border min-w-0";

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-title-lg text-primary-dark">Relatórios</h1>
                <p className="text-sm text-muted-foreground">Exporte seus dados em PDF para conferência.</p>
            </div>

            {/* ✅ AJUSTE AQUI */}
            <div className="flex gap-1 bg-gray-100 p-1.5 rounded-2xl shadow-inner border border-gray-200 overflow-hidden">
                <button
                    onClick={() => setReportType('hours')}
                    className={`flex-1 min-w-0 whitespace-nowrap py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                        reportType === 'hours'
                            ? 'bg-primary text-white shadow-md'
                            : 'text-gray-500 hover:bg-gray-200'
                    }`}
                >
                    <Clock className="w-4 h-4" /> Ponto & Horas
                </button>

                <button
                    onClick={() => setReportType('km')}
                    className={`flex-1 min-w-0 whitespace-nowrap py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                        reportType === 'km'
                            ? 'bg-primary text-white shadow-md'
                            : 'text-gray-500 hover:bg-gray-200'
                    }`}
                >
                    <Map className="w-4 h-4" /> KM Rodado
                </button>
            </div>

            <PdfPreviewModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                pdfUrl={pdfPreviewUrl}
                fileName={`Jornada360_${reportType}_${startDate}_${endDate}.pdf`}
            />
        </div>
    );
};

export default ReportsPage;


import React, { useState, useMemo, useEffect } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';
import { useAuth } from '../contexts/AuthContext';
import { getMonthSummary, calculateJourney, formatMinutesToHours } from '../lib/utils';
import { FileDown, Clock, Map, AlertCircle, Lock, Crown } from 'lucide-react';
import PdfPreviewModal from '../components/ui/PdfPreviewModal';

type ReportType = 'hours' | 'km';

const ReportsPage: React.FC = () => {
    const { journeys, settings } = useJourneys();
    const { user, isPro } = useAuth();
    const navigate = useNavigate();
    
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

    const generatePdf = async () => {
        if (!isPro) {
            navigate('/premium');
            return;
        }

        const filtered = journeys.filter(j => j.date >= startDate && j.date <= endDate);
        if (!filtered.length) {
            alert('Nenhum registro encontrado.');
            return;
        }

        setIsGenerating(true);
        try {
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.text("Relatório Jornada360", 14, 20);
            doc.text(`Colaborador: ${user?.user_metadata?.nome}`, 14, 30);
            setPdfPreviewUrl(doc.output("datauristring")); 
            setIsModalOpen(true);
        } catch (e: any) { 
            alert(`Erro ao gerar: ${e.message}`); 
        } finally { 
            setIsGenerating(false); 
        }
    };

    const commonInputStyles = "block w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-gray-50 font-medium text-primary-dark outline-none transition-all";

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-title-lg text-primary-dark">Relatórios</h1>
                <p className="text-sm text-muted-foreground">Exporte seus dados em PDF para conferência.</p>
            </div>

            <div className="flex bg-gray-100 p-1.5 rounded-2xl shadow-inner border border-gray-200">
                <button onClick={() => setReportType('hours')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${reportType === 'hours' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>
                    <Clock className="w-4 h-4" /> Ponto & Horas
                </button>
                <button onClick={() => setReportType('km')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${reportType === 'km' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>
                    <Map className="w-4 h-4" /> KM Rodado
                </button>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-soft border border-gray-100 space-y-6 relative overflow-hidden">
                {!isPro && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mb-4 shadow-lg ring-4 ring-accent/20">
                            <Lock className="w-8 h-8 text-primary-dark" />
                        </div>
                        <h3 className="text-xl font-black text-primary-dark mb-2">Recurso Premium</h3>
                        <p className="text-sm text-gray-600 mb-6">A exportação de relatórios em PDF está disponível apenas para assinantes PRO.</p>
                        <button 
                            onClick={() => navigate('/premium')}
                            className="bg-accent text-primary-dark font-black px-8 py-3 rounded-2xl flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
                        >
                            <Crown className="w-5 h-5" /> Ver Planos
                        </button>
                    </div>
                )}

                <div className="w-full">
                    <label className="text-xs font-bold text-primary-dark/60 uppercase tracking-widest mb-2 block">Referência do Mês</label>
                    <select value={selectedOptionIndex} onChange={(e) => setSelectedOptionIndex(parseInt(e.target.value))} className={commonInputStyles}>
                        {monthOptions.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
                    </select>
                </div>

                <div className="space-y-4 w-full">
                    <div className="w-full">
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Início do Período</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={commonInputStyles} />
                    </div>
                    <div className="w-full">
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Fim do Período</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={commonInputStyles} />
                    </div>
                </div>

                <div className="pt-2 w-full">
                    <button onClick={generatePdf} disabled={isGenerating} className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg hover:bg-primary-dark transition active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70">
                        {isGenerating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <FileDown className="w-5 h-5" />}
                        Gerar Relatório PDF
                    </button>
                </div>
            </div>

            <PdfPreviewModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} pdfUrl={pdfPreviewUrl} fileName={`Jornada360_${startDate}_${endDate}.pdf`} />
        </div>
    );
};

export default ReportsPage;

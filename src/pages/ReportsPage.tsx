import React, { useState, useMemo } from 'react';
import { useJourneys } from '../contexts/JourneyContext';
import { useAuth } from '../contexts/AuthContext';
import { getMonthSummary, calculateJourney, formatMinutesToHours } from '../lib/utils';
import { FileDown } from 'lucide-react';
import PdfPreviewModal from '../components/ui/PdfPreviewModal'; // Importando o novo modal

const ReportsPage: React.FC = () => {
    const { journeys, settings } = useJourneys();
    const { user } = useAuth();
    
    // Estados para o modal de pré-visualização
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');

    const getCurrentAccountingPeriod = () => {
        if (!settings) {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return {
                start: firstDay.toISOString().split('T')[0],
                end: lastDay.toISOString().split('T')[0],
            };
        }
        
        const now = new Date();
        const startDay = settings.month_start_day || 1;
        let startDate = new Date(now.getFullYear(), now.getMonth(), startDay);
        if (now.getDate() < startDay) {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, startDay);
        }
        let endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDay - 1);
        
        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
        };
    };
    
    const [startDate, setStartDate] = useState(getCurrentAccountingPeriod().start);
    const [endDate, setEndDate] = useState(getCurrentAccountingPeriod().end);

    const filteredJourneys = useMemo(() => {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        return journeys.filter(j => {
            const journeyDate = new Date(j.date + 'T00:00:00');
            return journeyDate >= start && journeyDate <= end;
        });
    }, [journeys, startDate, endDate]);


    const generateAndPreviewPdf = () => {
        if (!filteredJourneys.length || !settings) {
            alert('Não há dados no período selecionado para gerar o relatório.');
            return;
        }

        // @ts-ignore
        const { jsPDF } = window.jspdf;
        // @ts-ignore
        const autoTable = window.jspdf.autoTable;
        const doc = new jsPDF();

        const userName = user?.user_metadata?.nome || 'Usuário';
        const period = `${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`;
        const pageMargin = 15;
        const pageWidth = doc.internal.pageSize.getWidth();

        const tableColumn = ["Data", "Início", "Fim", "Total", "HE 50%", "HE 100%", "KM", "RV", "Observações"];
        const tableRows: (string | number)[][] = [];
        const sortedJourneys = [...filteredJourneys].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        sortedJourneys.forEach(journey => {
            const calcs = calculateJourney(journey, settings);
            const journeyData = [
                new Date(journey.date + 'T00:00:00').toLocaleDateString('pt-BR'),
                journey.start_at,
                journey.end_at,
                formatMinutesToHours(calcs.totalTrabalhado),
                formatMinutesToHours(calcs.horasExtras50),
                formatMinutesToHours(calcs.horasExtras100),
                settings.km_enabled ? calcs.kmRodados.toFixed(1) : '-',
                journey.rv_number || '-',
                journey.notes || '-',
            ];
            tableRows.push(journeyData);
        });
        
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: "#1A2346" },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: { 8: { cellWidth: 'auto' } },
            margin: { top: 70 }, // Espaço para cabeçalho e resumo
            didDrawPage: (data: any) => {
                // --- CABEÇALHO (em todas as páginas) ---
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor("#1A2346"); // Cor 'primary'
                doc.text("Jornada360", pageMargin, 18);
        
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor("#6B7280"); // Cor 'muted-foreground'
                doc.text("Relatório de Jornada", pageWidth - pageMargin, 12, { align: 'right' });
                doc.text(`Período: ${period}`, pageWidth - pageMargin, 17, { align: 'right' });
                doc.text(`Motorista: ${userName}`, pageWidth - pageMargin, 22, { align: 'right' });
        
                // Linha separadora
                doc.setDrawColor("#E8EEF7"); // primary-light
                doc.setLineWidth(0.5);
                doc.line(pageMargin, 28, pageWidth - pageMargin, 28);

                // --- RESUMO (apenas na primeira página) ---
                if (data.pageNumber === 1) {
                    let summaryY = 38;
                    const summary = getMonthSummary(filteredJourneys, settings);
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor("#1A2346");
                    doc.text("Resumo do Período", pageMargin, summaryY);
                    summaryY += 7;
                    
                    const summaryText = [
                        `- Dias Trabalhados: ${summary.totalDiasTrabalhados}`,
                        `- Horas Trabalhadas: ${formatMinutesToHours(summary.totalTrabalhado)}`,
                        `- Horas Extras (50%): ${formatMinutesToHours(summary.horasExtras50)}`,
                        `- Horas Extras (100%): ${formatMinutesToHours(summary.horasExtras100)}`,
                    ];
                    if (settings.km_enabled) {
                        summaryText.push(`- KM Rodados: ${summary.kmRodados.toFixed(1)} km`);
                    }
            
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor("#374151");
                    doc.text(summaryText.join('\n'), pageMargin, summaryY);
                }

                // --- RODAPÉ (em todas as páginas) ---
                const pageCount = doc.internal.getNumberOfPages();
                doc.setFontSize(8);
                doc.setTextColor("#BDC6D1"); // muted color
                
                doc.text(`Página ${data.pageNumber} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, 287, { align: 'center' });
                doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageMargin, 287);
                doc.text(`Jornada360`, doc.internal.pageSize.getWidth() - pageMargin, 287, { align: 'right' });
            },
        });
        
        // Finalize PDF and open modal
        const pdfDataUri = doc.output('datauristring');
        setPdfPreviewUrl(pdfDataUri);
        setIsModalOpen(true);
    };
    
    const inputStyle = "w-full mt-1 p-3 bg-white border border-gray-300 rounded-lg text-primary-dark focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark transition";

    return (
        <div className="space-y-6">
            <h1 className="text-title-lg text-primary-dark">Exportar Relatório</h1>
            <div className="bg-white p-6 rounded-2xl shadow-soft">
                 <p className="text-muted-foreground mb-4 text-center">
                    Selecione o período desejado para gerar seu relatório em PDF.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="text-sm font-medium">Data de Início</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputStyle} />
                    </div>
                     <div>
                        <label className="text-sm font-medium">Data Final</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputStyle} />
                    </div>
                </div>
                <div className="text-center">
                    <button
                        onClick={generateAndPreviewPdf}
                        disabled={!filteredJourneys.length}
                        className="inline-flex items-center gap-2 justify-center rounded-lg border border-transparent bg-primary py-3 px-6 text-base font-medium text-white shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:bg-opacity-50"
                    >
                        <FileDown className="w-5 h-5" />
                        Gerar Relatório ({filteredJourneys.length} {filteredJourneys.length === 1 ? 'dia' : 'dias'})
                    </button>
                </div>
            </div>

            {/* Inclusão do modal de preview */}
            <PdfPreviewModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                pdfUrl={pdfPreviewUrl}
                fileName={`relatorio_${user?.user_metadata?.nome?.split(' ')[0].toLowerCase() || 'jornada360'}_${startDate}_a_${endDate}.pdf`}
            />
        </div>
    );
};

export default ReportsPage;

import React, { useState, useMemo } from 'react';
import { useJourneys } from '../contexts/JourneyContext';
import { useAuth } from '../contexts/AuthContext';
import { getMonthSummary, calculateJourney, formatMinutesToHours } from '../lib/utils';
import { FileDown } from 'lucide-react';
import PdfPreviewModal from '../components/ui/PdfPreviewModal';

const ReportsPage: React.FC = () => {
    const { journeys, settings } = useJourneys();
    const { user } = useAuth();
    
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
            const date = new Date(j.date + 'T00:00:00');
            return date >= start && date <= end;
        });
    }, [journeys, startDate, endDate]);


    const generateAndPreviewPdf = () => {
        if (!filteredJourneys.length || !settings) {
            alert('Não há dados no período selecionado para gerar o relatório.');
            return;
        }

        // @ts-ignore
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const userName = user?.user_metadata?.nome || 'Usuário';
        const period = `${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`;

        // 📌 CABEÇALHO ATUALIZADO
        doc.setFont("helvetica", "bold"); 
        doc.setFontSize(14);
        doc.setTextColor("#0C2344");
        doc.text("Jornada 360 — Relatório de Jornada", 14, 15);

        doc.setFontSize(8);
        doc.setTextColor("#9CA3AF");
        doc.text("by luizdovaletech", doc.internal.pageSize.getWidth() - 14, 15, { align: "right" });

        doc.setFontSize(10);
        doc.setTextColor("#6B7280");
        doc.text(`${userName} | ${period}`, 14, 21);

        // RESUMO
        const summary = getMonthSummary(filteredJourneys, settings);
        
        doc.setFontSize(10);
        doc.setTextColor("#374151");
        
        const summaryY = 30;
        doc.text(`Dias Trabalhados: ${summary.totalDiasTrabalhados}`, 14, summaryY);
        doc.text(`Extras 50%: ${formatMinutesToHours(summary.horasExtras50)}`, 60, summaryY);
        doc.text(`Extras 100%: ${formatMinutesToHours(summary.horasExtras100)}`, 110, summaryY);

        if (settings.km_enabled) {
            doc.text(`KM: ${summary.kmRodados.toFixed(1)}`, 160, summaryY);
        }

        // TABELA
        const tableColumn = ["Data", "Início", "Fim", "Total", "HE 50%", "HE 100%", "KM", "RV", "Observações"];
        const tableRows: any[] = [];

        const sortedJourneys = [...filteredJourneys].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        sortedJourneys.forEach(journey => {
            const calcs = calculateJourney(journey, settings);

            if (journey.is_day_off) {
                const style = { textColor: [220, 38, 38], fontStyle: 'bold', fontSize: 7 };
                tableRows.push([
                    { content: new Date(journey.date).toLocaleDateString('pt-BR'), styles: style },
                    { content: "FOLGA", styles: style },
                    { content: "FOLGA", styles: style },
                    { content: "", styles: style },
                    { content: "-", styles: style },
                    { content: "-", styles: style },
                    { content: settings.km_enabled ? calcs.kmRodados.toFixed(1) : "-", styles: {} },
                    { content: journey.rv_number || "-", styles: {} },
                    { content: journey.notes || "-", styles: {} },
                ]);
            } else {
                tableRows.push([
                    new Date(journey.date).toLocaleDateString('pt-BR'),
                    journey.start_at ? journey.start_at.slice(0, 5) : "-",
                    journey.end_at ? journey.end_at.slice(0, 5) : "-",
                    formatMinutesToHours(calcs.totalTrabalhado),
                    formatMinutesToHours(calcs.horasExtras50),
                    formatMinutesToHours(calcs.horasExtras100),
                    settings.km_enabled ? calcs.kmRodados.toFixed(1) : "-",
                    journey.rv_number || "-",
                    journey.notes || "-"
                ]);
            }
        });

        // @ts-ignore
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 38,
            theme: 'grid',
            headStyles: { fillColor: "#0C2344", fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 2, halign: "center" },
            columnStyles: { 
                8: { halign: "left", cellWidth: "auto" }
            },
        });

        // RODAPÉ
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor("#BDC6D1");

            doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, 287, { align: "center" });
            doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 287);
        }

        const uri = doc.output("datauristring");
        setPdfPreviewUrl(uri);
        setIsModalOpen(true);
    };

    const inputStyle =
        "w-full mt-1 p-3 bg-white border border-gray-300 rounded-lg text-primary-dark focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark transition";

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
                        className="inline-flex items-center gap-2 justify-center rounded-lg bg-primary py-3 px-6 text-base font-medium text-white shadow hover:bg-primary-dark active:scale-95 disabled:bg-opacity-50"
                    >
                        <FileDown className="w-5 h-5" />
                        Gerar Relatório ({filteredJourneys.length} {filteredJourneys.length === 1 ? "dia" : "dias"})
                    </button>
                </div>
            </div>

            <PdfPreviewModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                pdfUrl={pdfPreviewUrl}
                fileName={`relatorio_${user?.user_metadata?.nome?.split(' ')[0]?.toLowerCase() || "jornada360"}_${startDate}_a_${endDate}.pdf`}
            />
        </div>
    );
};

export default ReportsPage;

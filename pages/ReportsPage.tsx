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
        const doc = new jsPDF();

        const userName = user?.user_metadata?.nome || 'Usuário';
        const period = `${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`;

        // Cabeçalho - Ajustado para ocupar menos espaço
        doc.setFontSize(16); // Reduzido de 18 (padrão aproximado)
        doc.setTextColor("#0C2344");
        doc.text("Relatório de Jornada", 14, 15);
        
        doc.setFontSize(10);
        doc.setTextColor("#6B7280");
        doc.text(`${userName} | ${period}`, 14, 20);

        // Resumo - Compactado
        const summary = getMonthSummary(filteredJourneys, settings);
        
        // Posicionando o resumo à direita ou em uma linha compacta
        doc.setFontSize(10);
        doc.setTextColor("#374151");
        
        const summaryY = 28;
        doc.text(`Dias Trabalhados: ${summary.totalDiasTrabalhados}`, 14, summaryY);
        doc.text(`Extras 50%: ${formatMinutesToHours(summary.horasExtras50)}`, 60, summaryY);
        doc.text(`Extras 100%: ${formatMinutesToHours(summary.horasExtras100)}`, 110, summaryY);
        if (settings.km_enabled) {
            doc.text(`KM: ${summary.kmRodados.toFixed(1)}`, 160, summaryY);
        }

        // Tabela de Jornadas
        const tableColumn = ["Data", "Início", "Fim", "Total", "HE 50%", "HE 100%", "KM", "RV", "Observações"];
        const tableRows: (string | number | { content: string, styles: any })[][] = [];
        const sortedJourneys = [...filteredJourneys].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        sortedJourneys.forEach(journey => {
            const calcs = calculateJourney(journey, settings);
            
            let rowData;
            
            if (journey.is_day_off) {
                // Estilo para linhas de folga: Texto vermelho e "FOLGA" nos campos de tempo
                const folgaStyle = { textColor: [220, 38, 38], fontStyle: 'bold' };
                
                rowData = [
                    { content: new Date(journey.date + 'T00:00:00').toLocaleDateString('pt-BR'), styles: folgaStyle },
                    { content: "FOLGA", styles: folgaStyle },
                    { content: "FOLGA", styles: folgaStyle },
                    { content: "-", styles: folgaStyle }, // Total
                    { content: "-", styles: folgaStyle }, // HE 50%
                    { content: "-", styles: folgaStyle }, // HE 100%
                    { content: settings.km_enabled ? (calcs.kmRodados > 0 ? calcs.kmRodados.toFixed(1) : '-') : '-', styles: {} }, // KM mantém cor normal se houver
                    { content: journey.rv_number || '-', styles: {} },
                    { content: journey.notes || '-', styles: {} },
                ];
            } else {
                // Linha normal
                rowData = [
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
            }
            
            tableRows.push(rowData);
        });
        
        // @ts-ignore
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 35, // Subiu a tabela
            theme: 'grid',
            headStyles: { 
                fillColor: "#0C2344",
                fontSize: 8,
                halign: 'center'
            },
            styles: { 
                fontSize: 8,
                cellPadding: 2,
                halign: 'center'
            },
            columnStyles: { 
                0: { cellWidth: 18 }, // Data
                1: { cellWidth: 12 }, // Início
                2: { cellWidth: 12 }, // Fim
                3: { cellWidth: 15 }, // Total
                4: { cellWidth: 15 }, // HE 50
                5: { cellWidth: 15 }, // HE 100
                6: { cellWidth: 15 }, // KM
                7: { cellWidth: 20 }, // RV
                8: { cellWidth: 'auto', halign: 'left' } // Obs
            },
            didParseCell: function(data: any) {
                // Opcional: Adicionar fundo vermelho claro para linhas de folga
                if (data.row.raw && data.row.raw[1] && data.row.raw[1].content === 'FOLGA') {
                   data.cell.styles.fillColor = [255, 235, 235];
                }
            }
        });

        // Rodapé
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor("#BDC6D1");
            doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, 287, { align: 'center' });
            doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 287);
        }

        // Gera a Data URI e abre o modal
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
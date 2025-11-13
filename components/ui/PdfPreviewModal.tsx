import React, { useEffect, useState } from 'react';
import { X, Download, Share2 } from 'lucide-react';

interface PdfPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    pdfUrl: string;
    fileName: string;
}

const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({ isOpen, onClose, pdfUrl, fileName }) => {
    const [canShare, setCanShare] = useState(false);

    // Converte Data URI para um objeto File para poder usar na Web Share API
    const dataURIToFile = (dataURI: string, filename: string): File | null => {
        if (!dataURI) return null;
        const [meta, data] = dataURI.split(',');
        // @ts-ignore - meta é garantido se dataURI for válido
        const mime = meta.match(/:(.*?);/)[1];
        const bstr = atob(data);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    };

    useEffect(() => {
        const checkShareability = async () => {
            // Verifica se a API de compartilhamento existe e se há uma URL de PDF
            if (navigator.share && pdfUrl) {
                const file = dataURIToFile(pdfUrl, fileName);
                // Verifica se o navegador suporta o compartilhamento do tipo 'file'
                if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
                    setCanShare(true);
                } else {
                    setCanShare(false);
                }
            } else {
                setCanShare(false);
            }
        };
        checkShareability();
    }, [pdfUrl, fileName]);


    if (!isOpen) return null;

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleShare = async () => {
        if (!canShare) {
            alert('Seu navegador não suporta o compartilhamento de arquivos.');
            return;
        }
        try {
            const file = dataURIToFile(pdfUrl, fileName);
            if (file) {
                 await navigator.share({
                    files: [file],
                    title: 'Relatório de Jornada',
                    text: `Aqui está o relatório de jornada: ${fileName}`,
                });
            }
        } catch (error) {
            console.error('Erro ao compartilhar:', error);
            // Ignora o erro se o usuário simplesmente fechar a caixa de diálogo de compartilhamento
            if (!(error instanceof DOMException && error.name === 'AbortError')) {
                alert('Não foi possível compartilhar o arquivo.');
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-2 animate-in fade-in-0" onClick={onClose}>
            <div className="bg-gray-200 rounded-2xl shadow-lg w-full max-w-4xl h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 bg-white rounded-t-2xl border-b flex justify-between items-center flex-shrink-0">
                    <h2 className="text-lg font-bold text-primary-dark truncate pr-4">{fileName}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-2 rounded-full bg-gray-100 hover:bg-gray-200"><X /></button>
                </div>

                {/* PDF Viewer */}
                <div className="flex-1 bg-gray-500 overflow-hidden">
                    {pdfUrl ? (
                         <iframe
                            src={pdfUrl}
                            title="Visualizador de PDF"
                            className="w-full h-full border-none"
                         />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white">Carregando PDF...</div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-white rounded-b-2xl border-t flex justify-end gap-3 flex-shrink-0">
                     <button
                        onClick={handleDownload}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Baixar
                    </button>
                    {canShare && (
                        <button
                            onClick={handleShare}
                            className="px-4 py-2 bg-accent text-primary-dark font-bold rounded-lg hover:brightness-95 transition-colors flex items-center gap-2"
                        >
                            <Share2 className="w-4 h-4" />
                            Compartilhar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PdfPreviewModal;
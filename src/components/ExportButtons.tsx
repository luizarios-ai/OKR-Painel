import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  onExportExcel: () => void;
  onExportPDF: () => void;
};

export default function ExportButtons({ onExportExcel, onExportPDF }: Props) {
  const [loadingType, setLoadingType] = useState<"pdf" | "excel" | null>(null);
  const { toast } = useToast();

  async function handle(type: "pdf" | "excel") {
    setLoadingType(type);
    try {
      await new Promise((r) => setTimeout(r, 100)); // let UI update
      if (type === "excel") onExportExcel();
      else onExportPDF();
      toast({ title: "Arquivo gerado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao exportar", description: err?.message, variant: "destructive" });
    } finally {
      setLoadingType(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => handle("excel")} disabled={!!loadingType}>
        {loadingType === "excel" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
        Exportar Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => handle("pdf")} disabled={!!loadingType}>
        {loadingType === "pdf" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
        Exportar PDF
      </Button>
    </div>
  );
}

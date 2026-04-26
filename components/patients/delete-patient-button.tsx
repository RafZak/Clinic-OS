"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DeletePatientsDialog } from "@/components/patients/delete-patients-dialog";

export function DeletePatientButton({ patientId }: { patientId: string }) {
  const t = useTranslations("patients");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:bg-red-50 hover:text-red-700"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        {t("deleteOne")}
      </Button>
      <DeletePatientsDialog
        open={open}
        onOpenChange={setOpen}
        patientIds={[patientId]}
        onDeleted={() => {
          router.push("/patients");
          router.refresh();
        }}
      />
    </>
  );
}

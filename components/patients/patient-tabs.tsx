"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function PatientTabs({
  journey,
  insights,
  abstract,
  detail,
}: {
  journey: ReactNode;
  insights: ReactNode;
  abstract: ReactNode;
  detail: ReactNode;
}) {
  const t = useTranslations("patientTabs");
  return (
    <Tabs defaultValue="journey" className="w-full">
      <TabsList>
        <TabsTrigger value="journey">{t("journey")}</TabsTrigger>
        <TabsTrigger value="insights">{t("insights")}</TabsTrigger>
        <TabsTrigger value="abstract">{t("abstract")}</TabsTrigger>
        <TabsTrigger value="detail">{t("detail")}</TabsTrigger>
      </TabsList>
      <TabsContent value="journey" className="mt-4">
        {journey}
      </TabsContent>
      <TabsContent value="insights" className="mt-4">
        {insights}
      </TabsContent>
      <TabsContent value="abstract" className="mt-4">
        {abstract}
      </TabsContent>
      <TabsContent value="detail" className="mt-4">
        {detail}
      </TabsContent>
    </Tabs>
  );
}

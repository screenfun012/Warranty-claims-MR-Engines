/**
 * PDF templates for Export Planner - Dado list and Final export list
 * Uses @react-pdf/renderer - must run on server (API route)
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10 },
  title: { fontSize: 14, marginBottom: 4, fontWeight: "bold" },
  subtitle: { fontSize: 9, marginBottom: 16, color: "#444" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 6, alignItems: "center" },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingBottom: 6, marginBottom: 4, fontWeight: "bold" },
  colMrCode: { width: "22%" },
  colRn: { width: "22%" },
  colKod: { width: "22%" },
  colTip: { width: "22%" },
  colOk: { width: "12%", textAlign: "center" as const },
  checkbox: { width: 14, height: 14, borderWidth: 1, borderColor: "#000", margin: "auto" },
  footer: { position: "absolute" as const, bottom: 30, left: 40, right: 40, fontSize: 9, color: "#666", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 8 },
});

interface ExportBatchItem {
  id: string;
  rn: string;
  engineNo: string;
  engineType: string | null;
  mrCode: string | null;
  status: string;
  qcOk: boolean;
}

interface BatchData {
  batchCode: string;
  customName: string | null;
  exportDate: string;
  loadTime: string | null;
  items: ExportBatchItem[];
}

export function DadoListPdf({ batch }: { batch: BatchData }) {
  const exportDateStr = new Date(batch.exportDate).toLocaleDateString("sr-RS");
  const title = batch.customName || batch.batchCode;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Plan izvoza – {title}</Text>
        <Text style={styles.subtitle}>
          Datum utovara: {exportDateStr}
          {batch.loadTime ? ` • Vreme: ${new Date(batch.loadTime).toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" })}` : ""}
        </Text>
        {/* Šablon: MR Code | RN | Kod motora | Tip motora | OK (prazan pravougaonik) – sve listano jedan ispod drugog */}
        <View style={[styles.row, styles.headerRow]}>
          <Text style={styles.colMrCode}>MR Code</Text>
          <Text style={styles.colRn}>RN</Text>
          <Text style={styles.colKod}>Kod motora</Text>
          <Text style={styles.colTip}>Tip motora</Text>
          <Text style={styles.colOk}>OK</Text>
        </View>
        {batch.items.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.colMrCode}>{item.mrCode || "-"}</Text>
            <Text style={styles.colRn}>{item.rn}</Text>
            <Text style={styles.colKod}>{item.engineNo}</Text>
            <Text style={styles.colTip}>{item.engineType || "-"}</Text>
            <View style={styles.colOk}>
              <View style={styles.checkbox} />
            </View>
          </View>
        ))}
        <View style={styles.footer}>
          <Text>Kontrola: _________________  Datum: __________</Text>
        </View>
      </Page>
    </Document>
  );
}

export function FinalExportListPdf({ batch }: { batch: BatchData }) {
  const items = batch.items.filter((i) => i.status === "IZVOZ");
  const exportDateStr = new Date(batch.exportDate).toLocaleDateString("sr-RS");
  const title = batch.customName || batch.batchCode;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Finalna lista za izvoz – {title}</Text>
        <Text style={styles.subtitle}>
          Datum: {exportDateStr} • Generisano: {new Date().toLocaleString("sr-RS")}
        </Text>
        {/* Isti šablon: MR Code | RN | Kod motora | Tip motora | OK */}
        <View style={[styles.row, styles.headerRow]}>
          <Text style={styles.colMrCode}>MR Code</Text>
          <Text style={styles.colRn}>RN</Text>
          <Text style={styles.colKod}>Kod motora</Text>
          <Text style={styles.colTip}>Tip motora</Text>
          <Text style={styles.colOk}>OK</Text>
        </View>
        {items.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.colMrCode}>{item.mrCode || "-"}</Text>
            <Text style={styles.colRn}>{item.rn}</Text>
            <Text style={styles.colKod}>{item.engineNo}</Text>
            <Text style={styles.colTip}>{item.engineType || "-"}</Text>
            <View style={styles.colOk}>
              <View style={styles.checkbox} />
            </View>
          </View>
        ))}
        <View style={styles.footer}>
          <Text>Ukupno: {items.length} motora</Text>
        </View>
      </Page>
    </Document>
  );
}

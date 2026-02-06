/**
 * PDF templates for Export Planner (Dado list, Final export list)
 */

import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10 },
  title: { marginBottom: 8, fontSize: 14, fontWeight: "bold" },
  meta: { marginBottom: 14, color: "#333" },
  table: { display: "flex", flexDirection: "column" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd", paddingVertical: 5 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingVertical: 6, fontWeight: "bold" },
  cellMr: { width: 90 },
  cellRn: { width: 90 },
  cellEngine: { width: 100 },
  cellType: { width: 90 },
  cellOk: { width: 36, alignItems: "center" },
  // Kao u primeru: Kontrola i Datum sa crtama za upis
  signBlock: { marginTop: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  signField: { flexDirection: "row", alignItems: "center", gap: 6 },
  signLabel: { fontSize: 10 },
  signLine: { width: 120, borderBottomWidth: 1, borderBottomColor: "#333", paddingBottom: 2 },
});

type BatchProp = {
  batch: {
    batchCode: string;
    customName: string | null;
    exportDate: string;
    loadTime: string | null;
    items: Array<{ id: string; rn: string; engineNo: string; engineType: string | null; mrCode: string | null; status: string; qcOk: boolean }>;
  };
};

export function DadoListPdf({ batch }: BatchProp): React.ReactElement {
  const title = batch.customName || `Plan izvoza`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            <View style={styles.cellMr}><Text>MR Code</Text></View>
            <View style={styles.cellRn}><Text>RN</Text></View>
            <View style={styles.cellEngine}><Text>Kod motora</Text></View>
            <View style={styles.cellType}><Text>Tip motora</Text></View>
            <View style={styles.cellOk}><Text>OK</Text></View>
          </View>
          {batch.items.map((i) => (
            <View key={i.id} style={styles.row}>
              <View style={styles.cellMr}><Text>{i.mrCode ?? ""}</Text></View>
              <View style={styles.cellRn}><Text>{i.rn}</Text></View>
              <View style={styles.cellEngine}><Text>{i.engineNo}</Text></View>
              <View style={styles.cellType}><Text>{i.engineType ?? ""}</Text></View>
              <View style={styles.cellOk}><Text>☐</Text></View>
            </View>
          ))}
        </View>
        <View style={styles.signBlock}>
          <View style={styles.signField}>
            <Text style={styles.signLabel}>Kontrola:</Text>
            <View style={styles.signLine} />
          </View>
          <View style={styles.signField}>
            <Text style={styles.signLabel}>Datum:</Text>
            <View style={styles.signLine} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function FinalExportListPdf({ batch }: BatchProp): React.ReactElement {
  const filtered = batch.items.filter((i) => i.status === "IZVOZ");
  const title = batch.customName ? `Finalna lista – ${batch.customName}` : `Finalna lista za izvoz – ${batch.batchCode}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>Šifra: {batch.batchCode} · Datum: {batch.exportDate.slice(0, 10)} · Broj stavki: {filtered.length}</Text>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            <View style={styles.cellRn}><Text>RN</Text></View>
            <View style={styles.cellEngine}><Text>Engine No</Text></View>
            <View style={styles.cellType}><Text>Type</Text></View>
            <View style={styles.cellMr}><Text>MR Code</Text></View>
          </View>
          {filtered.map((i) => (
            <View key={i.id} style={styles.row}>
              <View style={styles.cellRn}><Text>{i.rn}</Text></View>
              <View style={styles.cellEngine}><Text>{i.engineNo}</Text></View>
              <View style={styles.cellType}><Text>{i.engineType ?? ""}</Text></View>
              <View style={styles.cellMr}><Text>{i.mrCode ?? ""}</Text></View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

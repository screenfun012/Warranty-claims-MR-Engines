/**
 * PDF templates for Export Planner (Dado list, Final export list)
 */

import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10 },
  title: { marginBottom: 16, fontSize: 14, fontWeight: "bold" },
  meta: { marginBottom: 12, color: "#666" },
  table: { display: "flex", flexDirection: "column" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee", paddingVertical: 4 },
  headerRow: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#333", paddingVertical: 6, fontWeight: "bold" },
  cellRn: { width: 80 },
  cellEngine: { width: 100 },
  cellType: { width: 80 },
  cellMr: { width: 60 },
  cellStatus: { width: 70 },
  cellOk: { width: 32, alignItems: "center" },
  // Na kraju: "OK" i ispod pravougaonik za čekiranje na štampanoj listi
  okBlock: { marginTop: 28, alignItems: "flex-start" },
  okLabel: { fontSize: 11, fontWeight: "bold", marginBottom: 6 },
  okBox: { width: 28, height: 28, borderWidth: 1.5, borderColor: "#333" },
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
  const title = batch.customName || `Lista motora – ${batch.batchCode}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>Šifra: {batch.batchCode} · Datum: {batch.exportDate.slice(0, 10)}</Text>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            <View style={styles.cellRn}><Text>RN</Text></View>
            <View style={styles.cellEngine}><Text>Engine No</Text></View>
            <View style={styles.cellType}><Text>Type</Text></View>
            <View style={styles.cellMr}><Text>MR</Text></View>
            <View style={styles.cellStatus}><Text>Status</Text></View>
            <View style={styles.cellOk}><Text>OK</Text></View>
          </View>
          {batch.items.map((i) => (
            <View key={i.id} style={styles.row}>
              <View style={styles.cellRn}><Text>{i.rn}</Text></View>
              <View style={styles.cellEngine}><Text>{i.engineNo}</Text></View>
              <View style={styles.cellType}><Text>{i.engineType ?? ""}</Text></View>
              <View style={styles.cellMr}><Text>{i.mrCode ?? ""}</Text></View>
              <View style={styles.cellStatus}><Text>{i.status}</Text></View>
              <View style={styles.cellOk}><Text>☐</Text></View>
            </View>
          ))}
        </View>
        <View style={styles.okBlock}>
          <Text style={styles.okLabel}>OK</Text>
          <View style={styles.okBox} />
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

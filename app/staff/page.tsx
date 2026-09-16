function sourceLabel(o: OrderRow) {
  if (o.channel === "grab")
    return `Grab${o.platform_order_no ? " · " + o.platform_order_no : ""}`;
  if (o.channel === "lineman")
    return `LINE MAN${o.platform_order_no ? " · " + o.platform_order_no : ""}`;
  if (o.channel === "store")
    return `หน้าร้าน${o.platform_order_no ? " · " + o.platform_order_no : ""}`;
  if (o.order_type === "table") return `โต๊ะ ${o.table_number}`;
  if (o.order_type === "takeaway")
    return `กลับบ้าน - ${o.customer_name} (${o.customer_phone})`;
  return "อื่นๆ";
}

// เฉพาะบิลปริ้น: รวมประเภทออเดอร์ + เลขออเดอร์ไว้บรรทัดเดียว ตามฟอร์แมตบิลที่ต้องการ
function printHeaderLabel(o: OrderRow) {
  if (o.channel === "grab")
    return `Grab / #${o.platform_order_no || o.id}`;
  if (o.channel === "lineman")
    return `LINE MAN / #${o.platform_order_no || o.id}`;
  if (o.channel === "store")
    return `หน้าร้าน / #${o.platform_order_no || o.id}`;
  if (o.order_type === "table") return `โต๊ะ ${o.table_number} / #${o.id}`;
  if (o.order_type === "takeaway") return `Take Away / #${o.id}`;
  return `#${o.id}`;
}

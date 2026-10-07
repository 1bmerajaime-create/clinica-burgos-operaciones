# CB Operaciones · Clínica Burgos

Panel interno para el seguimiento de **ingresos y gastos** de Clínica Burgos (Dra. de Teresa):

- Oftalmología (clínica)
- Medicina estética
- Hospital Quirón
- Concierto de cataratas

## Arranque

```bash
npm install
npm run dev
```

Abre la URL que indique Vite (por defecto `http://localhost:5173`).

## Qué incluye (v1)

- Dashboard con posición global, KPIs, mix por rama y gráfico de evolución
- Detalle por rama con evolución y movimientos
- Alta de ingresos y gastos por tipología
- Subida de facturas (asocia documento + crea gasto)
- Persistencia local en el navegador (`localStorage`) con datos demo de 2026

## Próximos pasos posibles

- Autenticación y multi-usuario
- Exportación a Excel / contabilidad
- Almacenamiento real de PDFs
- Conciliación bancaria y liquidaciones Quirón / concierto

const StatCard = ({ title, value, icon: Icon }) => (
  <div className="card flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h3 className="mt-2 text-3xl font-bold text-slate-900">{value}</h3>
    </div>
    {Icon && <div className="rounded-2xl bg-blue-50 p-4 text-blue-600"><Icon size={26} /></div>}
  </div>
)
export default StatCard

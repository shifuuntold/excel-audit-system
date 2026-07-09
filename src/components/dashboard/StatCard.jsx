export default function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
}) {
    return (
        <div className="bg-white rounded-xl shadow-sm border p-6">

            <div className="flex justify-between items-start">

                <div>

                    <p className="text-sm text-gray-500">
                        {title}
                    </p>

                    <h2 className="text-3xl font-bold mt-2">
                        {value}
                    </h2>

                    <p className="text-sm text-gray-400 mt-2">
                        {subtitle}
                    </p>

                </div>

                <Icon className="w-9 h-9 text-blue-700" />

            </div>

        </div>
    );
}
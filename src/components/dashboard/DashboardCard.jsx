export default function DashboardCard({
    title,
    description,
    icon: Icon,
    onClick,
}) {

    return (

        <button
            onClick={onClick}
            className="
                bg-white
                rounded-xl
                shadow-sm
                border
                hover:shadow-lg
                hover:-translate-y-1
                transition-all
                duration-200
                p-6
                text-left
                w-full
            "
        >

            <Icon className="w-10 h-10 text-blue-700 mb-5" />

            <h3 className="text-lg font-bold">

                {title}

            </h3>

            <p className="text-gray-500 mt-2">

                {description}

            </p>

        </button>

    );

}
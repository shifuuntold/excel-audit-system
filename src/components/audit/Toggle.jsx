export default function Toggle({

    options,

    value,

    onChange

}) {

    return (

        <div className="flex gap-3">

            {options.map(option=>(

                <button

                    key={option}

                    type="button"

                    onClick={()=>onChange(option)}

                    className={

                        value===option

                        ? "bg-blue-700 text-white px-4 py-2 rounded"

                        : "bg-white border px-4 py-2 rounded"

                    }

                >

                    {option}

                </button>

            ))}

        </div>

    );

}
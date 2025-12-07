import CategoryAccordion from "./CategoryAccordion";

export default function Remember() {
    return (
        <div className="flex flex-col lifeboard-card max-w-md w-full p-6 gap-4">
            <h3 className="lifeboard-card-title">Remember with Context</h3>
            <CategoryAccordion />
        </div>
    );
}
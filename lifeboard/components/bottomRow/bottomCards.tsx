// import Remember from "../remember/Remember";
import Tasks from "../tasks/Tasks";


export default function BottomCards() {
    return (
        <div className="w-full max-w-5xl mx-auto px-4 py-8 flex flex-row justify-between gap-5 items-center">
            {/* Bottom row content goes here */}
    
        {/* <Remember /> */}
        <Tasks />
        </div>
    );
}
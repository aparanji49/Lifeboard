import Image from "next/image";

export default function Header() {
  return ( 
    <header className="flex items-center justify-center py-6">
      <Image src={"/logo.png"} alt="LifeBoard" width={200} height={20}/>
    </header>
  );
}
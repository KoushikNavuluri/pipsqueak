import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useSession } from "../session";
import { Aura, Logo } from "../brand";
import { EASE } from "../ui";

export function NotFound() {
  const { user } = useSession();
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-paper">
      <Aura className="inset-x-0 top-1/4 h-[60%]" />
      <header className="relative px-6 py-5 sm:px-10">
        <Logo />
      </header>
      <main className="relative flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="eyebrow">
          Error 404
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="display pip-dot mt-4 text-[56px] leading-[1.02] sm:text-[84px]">
          Nothing grew here
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-5 max-w-md text-[17px] leading-relaxed text-mute">
          The page you were looking for doesn't exist, or it moved somewhere else.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Link to={user ? "/app" : "/"} className="group mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-white transition-colors hover:bg-ink-2">
            {user ? "Back to your designs" : "Back to Pipsqueak"}
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </main>
    </div>
  );
}

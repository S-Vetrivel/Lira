import React, { useContext, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ThemeContext } from "@/context/ThemeContext";
import { 
  Shield, 
  Zap, 
  Globe, 
  Award, 
  Activity, 
  ArrowRight, 
  CheckCircle2,
  Cpu,
  Trophy
} from "lucide-react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";

// --- DATA & CONSTANTS ---
const SYNERGY_CARDS = [
  {
    title: "Swiss Precision (IN2)",
    description: "Meticulous quality standards, structural innovation, and premium engineering guidelines developed in Switzerland.",
    image: "https://images.unsplash.com/photo-1531259683007-016a7b628fc3?q=80&w=1000&auto=format&fit=crop",
    icon: Cpu,
  },
  {
    title: "Indian Passion (4i International)",
    description: "Fueled by deep-rooted expertise, advanced manufacturing capabilities, and a skyrocketing sports culture.",
    image: "https://images.unsplash.com/photo-1506461883276-5d4a46aa3576?q=80&w=1000&auto=format&fit=crop",
    icon: Activity,
  }
];

export default function About() {
  const { theme } = useContext(ThemeContext);
  const containerRef = useRef(null);

  // Parallax Scroll Effects
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 1.1]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 0.3], [0, 100]);

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-screen overflow-hidden -mt-[90px]"
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
      }}
    >
      <SEO 
        title="About Us | 4i Global Sports Hub"
        description="Learn about the 4iglobalsportshub revolutionary global platform. Swiss engineering meets Indian passion to deliver elite badminton gear Beyond Limits."
      />
      {/* --- HERO SECTION --- */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        <motion.div 
          style={{ scale: heroScale, opacity: heroOpacity }}
          className="absolute inset-0 z-0"
        >
          <img
            src="https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?q=80&w=1920&auto=format&fit=crop"
            alt="Badminton Action"
            className="w-full h-full object-cover object-center"
          />
          {/* Subtle Overlays for depth and readability */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
        </motion.div>

        <div className="relative z-10 text-center px-6 text-white">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            style={{ y: textY }}
          >
            <h1 className="text-5xl md:text-8xl font-black tracking-tight mb-6">
              <span className="text-white lowercase">4i</span> <span className="text-white uppercase">Global</span><br />
              <span className="uppercase text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-emerald-500 to-green-600">
                Sports Hub
              </span>
            </h1>
            <p className="text-xl md:text-2xl font-light opacity-90 max-w-3xl mx-auto mb-8 leading-relaxed">
              Empowering, connecting, and equipping badminton players across the world with professional-grade gear.
            </p>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="inline-flex items-center gap-4 px-6 py-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20"
            >
              <span className="text-sm font-bold uppercase tracking-widest text-green-400">Our Motto:</span>
              <span className="text-lg font-medium italic text-white">"Beyond Limits"</span>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50 text-white"
        >
          <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
          <div className="w-[1px] h-12 bg-white" />
        </motion.div>
      </section>

      {/* --- CORE PHILOSOPHY SECTION --- */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="inline-block p-2 px-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 font-bold uppercase tracking-wider text-sm">
              Core Philosophy
            </div>
            <h2 className="text-4xl md:text-6xl font-black uppercase leading-tight">
              Beyond <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-500">Limits</span>
            </h2>
            <p className="text-lg opacity-80 leading-relaxed font-light">
              In sports, limits are everywhere—inflated costs for premium gear, lack of access to advanced technology, and geographic barriers. 4iglobalsportshub was built to erase those boundaries.
            </p>
            <p className="text-lg opacity-80 leading-relaxed font-light">
              We believe that elite-level performance shouldn't be exclusive to a select few. Your potential on the court should be defined solely by your dedication, grit, and passion—never by limitations in your equipment.
            </p>
            
            <ul className="space-y-4">
              {["Professional-grade gear for all", "Eradicating geographic barriers", "Accessible elite technology"].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-lg font-medium">
                  <CheckCircle2 className="text-green-500" size={24} />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden shadow-2xl"
          >
            <img 
              src="https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=1000&auto=format&fit=crop" 
              alt="Dedication on court"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-8 left-8 right-8 text-white">
              <div className="text-2xl font-bold italic">"Your game, your rules, no boundaries."</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- SWISS-INDIAN SYNERGY --- */}
      <section className="py-32 relative bg-current/[0.02]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">The Swiss-Indian Synergy</h2>
            <div className="h-1.5 w-32 bg-green-500 mx-auto rounded-full" />
            <p className="max-w-2xl mx-auto opacity-70">Bridging two distinct cultures to deliver a unique, world-class competitive advantage.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {SYNERGY_CARDS.map((card, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2 }}
                className="group relative h-[450px] rounded-3xl overflow-hidden border border-current/10 bg-current/[0.03] backdrop-blur-sm"
              >
                <div className="absolute inset-0 z-0">
                  <img 
                    src={card.image} 
                    alt={card.title}
                    className="w-full h-full object-cover opacity-40 group-hover:opacity-60 group-hover:scale-110 transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                </div>
                
                <div className="relative z-10 h-full p-10 flex flex-col justify-end items-start text-left text-white">
                  <div className="mb-6 p-4 rounded-2xl bg-green-500/20 border border-green-500/30 text-green-500">
                    <card.icon size={32} />
                  </div>
                  <h3 className="text-3xl font-black uppercase mb-4">{card.title}</h3>
                  <p className="opacity-80 leading-relaxed text-lg">{card.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- ENGINEERED FOR PERFORMANCE --- */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight">Engineered for<br />Performance</h2>
            <p className="max-w-md opacity-70">From racquets to apparel, we focus on every detail that enhances your real gameplay experience.</p>
          </div>
          <Link to="/shop" className="group flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-green-500">
            Explore Gear <ArrowRight className="group-hover:translate-x-2 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <motion.div 
            whileHover={{ y: -10 }}
            className="md:col-span-7 p-8 md:p-12 rounded-[2rem] bg-gradient-to-br from-neutral-900 to-neutral-800 text-white flex flex-col justify-between min-h-[400px] relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <Trophy className="text-green-400" size={32} />
                <span className="text-sm font-bold tracking-widest uppercase opacity-60">High-Performance Hardware</span>
              </div>
              <h3 className="text-4xl md:text-5xl font-black uppercase mb-6 leading-tight">Racquets with <br />Explosive Power</h3>
              <p className="text-lg text-white/70 max-w-sm">Aerodynamic frames and high-tension capacity tailored for attacking, defensive, or tactical all-round styles.</p>
            </div>
            <img 
              src="https://images.unsplash.com/photo-1626225963073-221ad6ec3a94?q=80&w=600&auto=format&fit=crop" 
              className="absolute -right-20 -bottom-20 w-80 h-80 object-contain rotate-[-15deg] opacity-40 blur-[2px]"
              alt="Racquet"
            />
          </motion.div>

          <motion.div 
            whileHover={{ y: -10 }}
            className="md:col-span-5 p-8 md:p-12 rounded-[2rem] border border-current/10 bg-current/[0.03] backdrop-blur-md flex flex-col justify-between min-h-[400px]"
          >
            <div className="space-y-6">
              <div className="p-4 bg-green-500/10 rounded-2xl w-fit">
                <Shield className="text-green-500" size={32} />
              </div>
              <h3 className="text-3xl font-black uppercase">Premium Technical Apparel</h3>
              <p className="opacity-70">Footwork is everything. Our specialized socks provide shock absorption, moisture management, and arch support.</p>
            </div>
            <div className="pt-8 border-t border-current/10">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-sm font-bold uppercase opacity-50">Cotton & Terry Blend</div>
                <div className="text-sm font-bold uppercase opacity-50">Shock Absorption</div>
                <div className="text-sm font-bold uppercase opacity-50">Moisture Control</div>
                <div className="text-sm font-bold uppercase opacity-50">Arch Support</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- GLOBAL VISION --- */}
      <section className="py-32 px-6 bg-gradient-to-b from-transparent to-green-500/10 relative">
        <div className="max-w-4xl mx-auto text-center space-y-12 relative z-10">
          <Globe className="mx-auto text-green-500 mb-8" size={64} />
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">Our Global Vision</h2>
          <p className="text-xl md:text-2xl font-light leading-relaxed italic opacity-90">
            "To be the world’s most trusted, player-centric sports platform, celebrated for democratizing access to elite gear. We build a global community where borders don't exist and performance reigns supreme."
          </p>
          <div className="pt-12">
            <h3 className="text-sm font-bold uppercase tracking-[0.5em] opacity-50 mb-8">Trusted by Players in</h3>
            <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 text-2xl font-black uppercase opacity-20">
              <span>Switzerland</span>
              <span>India</span>
              <span>Global Hubs</span>
              <span>Academy Teams</span>
            </div>
          </div>
        </div>
        
        {/* Background Decorative Text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[20vw] font-black opacity-[0.02] pointer-events-none select-none uppercase">
          Vision
        </div>
      </section>

      {/* --- FINAL CTA --- */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto rounded-[3rem] overflow-hidden bg-current text-white dark:text-black p-12 md:p-24 text-center relative">
          <div className="relative z-10 space-y-8">
            <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tight">Step onto the court.</h2>
            <p className="text-xl opacity-80 max-w-2xl mx-auto">Grab your gear, break through your limits, and join the global 4iglobalsportshub community.</p>
            <div className="flex flex-wrap justify-center gap-6">
              <Link to="/shop">
                <button className="px-10 py-5 bg-green-500 text-white rounded-full font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-xl shadow-green-500/20">
                  Shop Professional Gear
                </button>
              </Link>
              <Link to="/contact">
                <button 
                  className="px-10 py-5 border rounded-full font-black uppercase tracking-widest hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white transition-all"
                  style={{ borderColor: theme.bg === "#000000" ? "#ffffff" : "#000000" }}
                >
                  Join the Hub
                </button>
              </Link>
            </div>
          </div>
          {/* Grainy Texture Overlay */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3%3Cfilter id='noiseFilter'%3%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
        </div>
      </section>
    </div>
  );
}

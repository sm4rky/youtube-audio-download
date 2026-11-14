import { motion, useReducedMotion } from 'motion/react';

const barWeights = [0.42, 0.74, 0.5, 0.92, 0.58, 0.82, 0.38];

export function VinylLoader() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col items-center" aria-hidden="true">
      <motion.div
        className="relative size-[118px] motion-reduce:transform-none!"
        initial={{ scale: 1 }}
        animate={{ scale: reduceMotion ? 1 : [1, 1.016, 1] }}
        transition={{
          duration: reduceMotion ? 0 : 4.4,
          repeat: reduceMotion ? 0 : Infinity,
          ease: 'easeInOut',
        }}
      >
        <motion.div
          className="absolute inset-0 rounded-full motion-reduce:transform-none!"
          initial={{ rotate: 0 }}
          animate={{ rotate: reduceMotion ? 0 : 360 }}
          transition={{
            duration: reduceMotion ? 0 : 36,
            repeat: reduceMotion ? 0 : Infinity,
            ease: 'linear',
          }}
        >
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_34%_24%,#3c2a1d,#221610_74%)] shadow-[0_24px_40px_-20px_rgba(42,26,17,0.9),inset_0_0_0_1px_rgba(255,240,220,0.09)]" />
          <div className="absolute inset-0 rounded-full bg-[repeating-radial-gradient(circle_at_50%_50%,rgba(255,238,216,0.10)_0_1px,transparent_1px_4px)] opacity-70" />
          <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,rgba(255,240,220,0.18),transparent_26%,transparent_64%,rgba(255,240,220,0.08))]" />
          <div className="absolute inset-[35%] rounded-full bg-[#d97439] shadow-[inset_0_0_0_1px_rgba(42,26,17,0.18)]" />
          <div className="absolute inset-[46.5%] rounded-full bg-[#221610]" />
          <div className="absolute inset-[47.6%] rounded-full bg-[#fff3df]/25" />
        </motion.div>
      </motion.div>

      <div className="relative z-10 -mt-3.5 flex h-8 items-center gap-[3.5px] rounded-full bg-[#fff3df] px-3 shadow-[0_14px_24px_-14px_rgba(42,26,17,0.9)] ring-1 ring-[#2a1a11]/10">
        {barWeights.map((weight, index) => (
          <motion.span
            key={index}
            className="w-[2.5px] rounded-full bg-[#2a1a11]/70 motion-reduce:transform-none!"
            style={{ height: 14 + weight * 10 }}
            initial={{ scaleY: 0.2 + weight * 0.1 }}
            animate={{
              scaleY: reduceMotion
                ? 1
                : [0.2 + weight * 0.1, 0.65 + weight * 0.35, 0.2 + weight * 0.1],
            }}
            transition={{
              duration: reduceMotion ? 0 : 1.4,
              delay: reduceMotion ? 0 : index * 0.1,
              repeat: reduceMotion ? 0 : Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  );
}

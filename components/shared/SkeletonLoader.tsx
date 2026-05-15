interface SkeletonLoaderProps {
  count?: number
}

export function SkeletonLoader({ count = 6 }: SkeletonLoaderProps) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="sk"
          style={{
            height: '62px',
            marginBottom: '7px',
          }}
        />
      ))}
    </div>
  )
}

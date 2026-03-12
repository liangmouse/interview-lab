import { Star, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslations } from "next-intl";

export function SocialProof() {
  const t = useTranslations("socialProof");

  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-card p-8 lg:p-12">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:justify-between">
            {/* Left side - Social proof */}
            <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
              <div className="flex -space-x-3">
                <Avatar className="size-12 border-2 border-background">
                  <AvatarImage src="/placeholder.svg?height=48&width=48" />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    JD
                  </AvatarFallback>
                </Avatar>
                <Avatar className="size-12 border-2 border-background">
                  <AvatarImage src="/placeholder.svg?height=48&width=48" />
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    SM
                  </AvatarFallback>
                </Avatar>
                <Avatar className="size-12 border-2 border-background">
                  <AvatarImage src="/placeholder.svg?height=48&width=48" />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    AL
                  </AvatarFallback>
                </Avatar>
                <Avatar className="size-12 border-2 border-background">
                  <AvatarImage src="/placeholder.svg?height=48&width=48" />
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    RK
                  </AvatarFallback>
                </Avatar>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="size-5 fill-primary text-primary"
                    />
                  ))}
                </div>
                <p className="text-2xl font-bold text-card-foreground">
                  {t("helped")} <span className="text-primary">10,000+</span>{" "}
                  {t("students")}
                  <br className="sm:hidden" /> {t("getOffers")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("description")}
                </p>
              </div>
            </div>

            {/* Right side - Stats */}
            <div className="flex gap-8">
              <div className="text-center">
                <div className="mb-1 flex items-center justify-center gap-2">
                  <Users className="size-5 text-primary" />
                  <span className="text-3xl font-bold text-card-foreground">
                    50+
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("topCompanies")}
                </p>
              </div>
              <div className="h-16 w-px bg-border" />
              <div className="text-center">
                <div className="mb-1 text-3xl font-bold text-card-foreground">
                  4.9/5
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("averageRating")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileText,
  Mic,
  MessageSquare,
  Activity,
  Code,
  Award,
} from "lucide-react";
import { useTranslations } from "next-intl";

export function FeaturesSection() {
  const t = useTranslations("features");

  const features = [
    {
      icon: FileText,
      title: t("items.resumeAnalysis.title"),
      description: t("items.resumeAnalysis.description"),
      gradient: "from-primary/20 to-primary/5",
    },
    {
      icon: MessageSquare,
      title: t("items.multiMode.title"),
      description: t("items.multiMode.description"),
      gradient: "from-accent/20 to-accent/5",
    },
    {
      icon: Activity,
      title: t("items.smartScoring.title"),
      description: t("items.smartScoring.description"),
      gradient: "from-primary/20 to-accent/10",
    },
    {
      icon: Code,
      title: t("items.codeAssessment.title"),
      description: t("items.codeAssessment.description"),
      gradient: "from-accent/20 to-primary/10",
    },
    {
      icon: Mic,
      title: t("items.voiceMode.title"),
      description: t("items.voiceMode.description"),
      gradient: "from-primary/15 to-accent/15",
    },
    {
      icon: Award,
      title: t("items.achievement.title"),
      description: t("items.achievement.description"),
      gradient: "from-accent/20 to-primary/5",
    },
  ];

  return (
    <section id="features" className="py-20 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-balance text-3xl font-bold tracking-tight text-foreground lg:text-4xl xl:text-5xl">
            {t("title")}
          </h2>
          <p className="mx-auto max-w-2xl text-pretty text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={index}
                className="group relative overflow-hidden border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity group-hover:opacity-100`}
                />

                <CardHeader className="relative">
                  <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-6" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-card-foreground">
                    {feature.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="relative">
                  <CardDescription className="text-base leading-relaxed text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

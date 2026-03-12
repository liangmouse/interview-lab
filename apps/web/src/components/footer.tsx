import { Link } from "@/i18n/navigation";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="flex flex-col justify-center gap-8 lg:flex-row lg:gap-24 xl:gap-32">
          {/* Brand */}
          <div className="max-w-sm">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
                <Sparkles className="size-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-foreground">
                Interview Lab
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {t("brandDesc")}
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-12 sm:gap-16">
            <div>
              <h3 className="mb-4 text-sm font-semibold text-foreground">
                {t("product")}
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="#features"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("features")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="#pricing"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("pricing")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("testimonials")}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-semibold text-foreground">
                {t("company")}
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="#about"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("about")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("blog")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("contact")}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 border-t border-border pt-8">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Interview Lab. {t("rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}

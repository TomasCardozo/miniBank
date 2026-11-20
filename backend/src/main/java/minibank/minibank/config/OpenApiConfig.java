package minibank.minibank.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI miniBankOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("MiniBank API")
                        .description("API REST de core bancario simplificado para gestion de cuentas, transferencias, movimientos, limites diarios y auditoria.")
                        .version("0.0.1"));
    }
}

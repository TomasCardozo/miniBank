package minibank.minibank.common.web;

import jakarta.servlet.http.HttpServletRequest;

public final class ClientIpResolver {

    private static final int MAX_IP_LENGTH = 45;

    private ClientIpResolver() {
    }

    public static String resolve(HttpServletRequest request) {
        return truncate(request.getRemoteAddr());
    }

    private static String truncate(String value) {
        if (value == null || value.length() <= MAX_IP_LENGTH) {
            return value;
        }

        return value.substring(0, MAX_IP_LENGTH);
    }
}

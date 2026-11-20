package minibank.minibank.common.exception;

import minibank.minibank.common.error.ErrorCodes;
import org.springframework.http.HttpStatus;

public class ForbiddenOperationException extends BusinessException {

    public ForbiddenOperationException(String message) {
        super(ErrorCodes.FORBIDDEN, message, HttpStatus.FORBIDDEN);
    }
}

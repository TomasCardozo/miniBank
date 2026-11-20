package minibank.minibank.common.exception;

import minibank.minibank.common.error.ErrorCodes;
import org.springframework.http.HttpStatus;

public class NotFoundException extends BusinessException {

    public NotFoundException(String message) {
        super(ErrorCodes.NOT_FOUND, message, HttpStatus.NOT_FOUND);
    }
}

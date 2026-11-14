package com.homecare.dispatch.config;

import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetup;
import jakarta.annotation.PreDestroy;
import jakarta.mail.internet.MimeMessage;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * DEMO MODE ONLY: an in-process SMTP server (GreenMail) that receives the e-mails sent by the
 * Camunda Email Outbound Connector. In production, SMTP_HOST/SMTP_PORT point at a real mail relay
 * and this server is disabled with MAIL_EMBEDDED_SERVER=false.
 */
@Slf4j
@Component
public class DemoMailServer {

    private final HomeCareProperties props;
    private GreenMail greenMail;

    public DemoMailServer(HomeCareProperties props) {
        this.props = props;
    }

    @EventListener(ApplicationReadyEvent.class)
    public synchronized void start() {
        if (!props.mail().embeddedServerEnabled() || greenMail != null) {
            return;
        }
        greenMail = new GreenMail(new ServerSetup(props.mail().port(), "0.0.0.0", ServerSetup.PROTOCOL_SMTP));
        greenMail.setUser(props.mail().from(), props.mail().username(), props.mail().password());
        greenMail.start();
        log.info("DEMO MODE: embedded SMTP server listening on port {}", props.mail().port());
    }

    /** Used by the EMAIL_SERVER=DOWN fault to make the connector's SMTP call fail for real. */
    public synchronized void stop() {
        if (greenMail != null) {
            greenMail.stop();
            greenMail = null;
            log.warn("DEMO MODE: embedded SMTP server stopped (simulated mail outage)");
        }
    }

    public synchronized boolean running() {
        return greenMail != null;
    }

    public synchronized List<MimeMessage> receivedMessages() {
        return greenMail == null ? List.of() : List.of(greenMail.getReceivedMessages());
    }

    @PreDestroy
    public void shutdown() {
        stop();
    }
}
